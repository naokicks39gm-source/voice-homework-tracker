import { getLastLine, normalizeText } from "./normalizer.js";
import { parseCommand } from "./parser.js?v=20260502-student-summary-01";
import { add, clearAllData, commit, getKey, getNumbers, loadFromLocalStorage, remove, submit } from "./storage.js?v=20260502-reset-01";
import { resetSpeechMemory, setSpeechHandler, startSpeech } from "./speech.js?v=20260502-logs-01";
import { buildStudentSummary, buildSummary } from "./summary.js?v=20260504-csv-01";
import { downloadCsv, downloadHtml, renderHistory, renderList, renderState, renderStudentSummaryTable, renderSummaryTable } from "./ui.js?v=20260508-student-html-01";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { publishStudentSummaryToFirestore } from "./firebasebackup.js";

function safeRender(state, cmd = null) {
  requestAnimationFrame(() => {
    render(state, cmd);
  });
}

function createInitialState() {
  return {
    grade: null,
    classNum: null,
    hw: null,
    submitted: new Set(),
    isLocked: false,
    lastProcessedLine: ""
  };
}
const YEARS = [2024, 2025, 2026];

const inputState = {
  year: "2026"
};

const textarea = document.getElementById("speechText");
const saveBtn = document.getElementById("saveBtn");
const resetTextBtn = document.getElementById("resetTextBtn");
const clearAllDataBtn = document.getElementById("clearAllDataBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const exportStudentHtmlBtn = document.getElementById("exportStudentHtmlBtn");
const firestoreLoginBtn = document.getElementById("firestoreLoginBtn");
const firestoreLogoutBtn = document.getElementById("firestoreLogoutBtn");
const firestoreBackupBtn = document.getElementById("firestoreBackupBtn");
const publishStudentShareBtn = document.getElementById("publishStudentShareBtn");
const firestoreStatus = document.getElementById("firestoreStatus");
let state = createInitialState();
let lastProcessedText = "";
let lastSavedText = "";
let lastSavedSignature = "";
let lastDebugCmdSignature = "";
let currentSummary = null;
let currentSummaryContext = null;
let saveLock = false;

function resolveKeyFromState(state) {
  if (!state.grade || !state.classNum || !state.hw) return null;

  return getKey({
    grade: state.grade,
    classNum: state.classNum,
    hw: state.hw
  });
}

function renderMetaControls() {
  const el = document.getElementById("metaControls");

  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin:10px 0;">

      <label>年度</label>
      <select id="yearSelect">
        ${YEARS.map(y => `
          <option value="${y}" ${inputState.year == y ? "selected" : ""}>
            ${y}
          </option>
        `).join("")}
      </select>

    </div>
  `;

  document.getElementById("yearSelect").onchange = e => {
    inputState.year = e.target.value;
    console.log("year:", inputState.year);
  };
}


function resetInput() {
  textarea.value = "";
}

function keepInputReset() {
  resetInput();
}

function resolveKey(cmd) {
  const grade = cmd.grade;
  const classNum = cmd.classNum;
  const hw = cmd.hw;

  if (!grade || !classNum || !hw) {
    return null;
  }

  return getKey({ grade, classNum, hw });
}

function syncState(state, cmd, key) {
  state.grade = cmd.grade ?? state.grade;
  state.classNum = cmd.classNum ?? state.classNum;
  state.hw = cmd.hw ?? state.hw;   // ← これが欠落してる

  if (key && Array.isArray(cmd.nums)) {
    cmd.nums.forEach(n => state.submitted.add(Number(n)));
  }
}

function extractNewPart(raw, last) {
  if (!last) {
    return raw;
  }

  if (raw.startsWith(last)) {
    return raw.slice(last.length).trim();
  }

  const index = raw.lastIndexOf(last);
  if (index !== -1) {
    return raw.slice(index + last.length).trim();
  }

  return raw;
}

function logDebugCommand(cmd, key) {
  const signature = `${cmd.type}:${key ?? ""}`;
  if (signature === lastDebugCmdSignature) {
    return;
  }

  lastDebugCmdSignature = signature;
}

function getDebugKey(cmd, key) {
  if (cmd.type === "studentSummary" && cmd.grade && cmd.classNum) {
    return `${cmd.grade}-${cmd.classNum}`;
  }

  return key;
}

function resetRuntimeMemory() {
  lastProcessedText = "";
  lastSavedText = "";
  lastSavedSignature = "";
  lastDebugCmdSignature = "";
  saveLock = false;
}

function resetTextInputOnly() {
  resetInput({ resetGuards: true });
  resetSpeechMemory();
  textarea.focus();
}

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function buildStudentShareHtml(rows) {
  const bodyRows = rows
    .slice()
    .sort((a, b) => a.student - b.student)
    .map((row) => {
      const submitted = new Set(row.submitted || []);
      const homeworkNumbers = [...(row.submitted || []), ...(row.missing || [])]
        .filter((hw) => Number.isFinite(hw))
        .sort((a, b) => a - b);
      const detail = homeworkNumbers.map((hw) => {
        const done = submitted.has(hw);
        return `<span class="${done ? "ok" : "ng"}">HW${escapeHtml(hw)}</span>`;
      }).join(" ");

      return `
        <tr>
          <td>${escapeHtml(row.student)}</td>
          <td>${escapeHtml(row.rate)}%</td>
          <td>${detail || "-"}</td>
        </tr>
      `;
    }).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>提出状況</title>
  <style>
    body { font-family: system-ui, sans-serif; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #999; padding: 6px; text-align: center; }
    .ok { background: #c8f7c5; display: inline-block; margin: 2px; padding: 2px 4px; }
    .ng { background: #f7c5c5; display: inline-block; margin: 2px; padding: 2px 4px; }
  </style>
</head>
<body>
  <h1>提出状況</h1>
  <table>
    <tr>
      <th>出席番号</th>
      <th>提出率</th>
      <th>詳細</th>
    </tr>
    ${bodyRows}
  </table>
</body>
</html>`;
}

function buildCsvText(rows, context) {
  const grade = context?.grade ?? "";
  const classNum = context?.classNum ?? "";

  if (rows[0]?.student !== undefined) {
    const header = [
      "学年",
      "組",
      "番号",
      "提出済み宿題",
      "未提出宿題",
      "提出率"
    ];
    const lines = rows.map((row) => [
      grade,
      classNum,
      row.student,
      (row.submitted || []).join(","),
      (row.missing || []).join(","),
      `${row.submittedCount}/${row.totalHw}（${row.rate}%）`
    ].map(escapeCsvValue).join(","));

    return [header.join(","), ...lines].join("\r\n");
  }

  const header = [
    "学年",
    "組",
    "宿題番号",
    "提出済み人数",
    "未提出人数",
    "提出率",
    "提出済み番号",
    "未提出番号"
  ];
  const lines = rows.map((row) => [
    grade,
    classNum,
    row.hw,
    (row.submitted || []).length,
    (row.missing || []).length,
    Number.isFinite(row.rate)
      ? row.rate
      : Math.round(((row.submitted || []).length / (((row.submitted || []).length + (row.missing || []).length) || 1)) * 100),
    (row.submitted || []).join(","),
    (row.missing || []).join(",")
  ].map(escapeCsvValue).join(","));

  return [header.join(","), ...lines].join("\r\n");
}

function exportCsv() {
  if (!currentSummary) {
    return;
  }

  if (!Array.isArray(currentSummary) || currentSummary.length === 0) {
    return;
  }

  const csvText = buildCsvText(currentSummary, currentSummaryContext);
  const filename = "homework-summary.csv";
  downloadCsv(filename, csvText);
}

function setFirestoreStatus(user) {
  if (!firestoreStatus) {
    return;
  }

  firestoreStatus.textContent = user ? "Firestore: ログイン済み" : "Firestore: 未ログイン";
}

async function loadFirebaseBackupModule() {
  return import("./firebaseBackup.js?v=20260508-student-public-01");
}

export function handleInput(text) {
  const rawText = String(text || "");

  if (rawText === "__RESET_DONE__") {
    return;
  }

  let processed = rawText.trim();
  processed = processed.replace(/^リセット[。、「」\s]*/, "");

  if (lastSavedText && processed.indexOf(lastSavedText) !== -1) {
    processed = extractNewPart(processed, lastSavedText);
  }

  if (!processed) {
    return;
  }



  text = processed;
const valueBefore = textarea.value;
textarea.value = processed;

// 同一なら無駄更新しない
if (valueBefore !== processed) {
  textarea.value = processed;
}

  const normalizedText = normalizeText(text);
  const rawSaveIndex = text.indexOf("保存");
  const normalizedSaveIndex = normalizedText.indexOf("保存");
  const saveIndex = rawSaveIndex !== -1 ? rawSaveIndex : normalizedSaveIndex;
  if (saveIndex !== -1) {
    text = (rawSaveIndex !== -1 ? text : normalizedText).slice(0, saveIndex + 2);
  }

  if (text && text === lastProcessedText) {
    return;
  }

  lastProcessedText = text;

const cmd = parseCommand(text);
const key = resolveKey(cmd);

console.log("CMD:", cmd);
console.log("KEY:", key);
console.log("STATE:", state);

  logDebugCommand(cmd, getDebugKey(cmd, key));

  if (cmd.type === "noop") {
    return;
  }

  if (cmd.type === "studentSummary") {
    const history = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");
    const rows = buildStudentSummary(history, cmd.grade, cmd.classNum, cmd.size);
    currentSummary = rows;
    currentSummaryContext = {
      grade: cmd.grade,
      classNum: cmd.classNum
    };
    renderStudentSummaryTable(rows);
    return;
  }

  if (cmd.type === "summary") {
    const grade = cmd.grade ?? state.grade;
    const classNum = cmd.classNum ?? state.classNum;
    if (!grade || !classNum || !cmd.size) {
      currentSummary = [];
      currentSummaryContext = null;
      renderSummaryTable([]);
      return;
    }

    const history = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");
    const rows = buildSummary(history, grade, classNum, cmd.size);
    currentSummary = rows;
    currentSummaryContext = {
      grade,
      classNum
    };
    renderSummaryTable(rows);
    return;
  }

  if (cmd.type === "save" && !key) {
    console.log("DEBUG_SKIP_INVALID_SAVE", JSON.stringify({ text }));
    keepInputReset();
    resetSpeechMemory();
    renderHistory();
  
    return;
  }

  if (!key) {

    return;
  }

  if (cmd.type === "submit") {
    saveLock = false;
    submit(key, cmd.nums);
    syncState(state, cmd, key, getNumbers);
    safeRender(state);
    return;
  }

  if (cmd.type === "add") {
    saveLock = false;
    add(key, cmd.nums);
    syncState(state, cmd, key, getNumbers);
    safeRender(state);
    return;
  }

  if (cmd.type === "delete") {
    saveLock = false;
    remove(key, cmd.nums);
    syncState(state, cmd, key, getNumbers);
   safeRender(state);
    return;
  }

  if (cmd.type === "save") {
    return;
  }

  saveLock = false;
  syncState(state, cmd, key, getNumbers);
  safeRender(state);
}

textarea.addEventListener("input", () => {
  if (state.isLocked) {
    return;
  }

  const raw = textarea.value.trim();
  let processed = raw;
  if (lastSavedText && raw.indexOf(lastSavedText) !== -1) {
    processed = extractNewPart(raw, lastSavedText);
    textarea.value = processed;

    if (!processed) {
      return;
    }
  }

  const value = processed.trim();
  if (value && value === lastProcessedText) {
    return;
  }

  const line = normalizeText(getLastLine(processed));

  if (line === state.lastProcessedLine) {
    return;
  }

  state.lastProcessedLine = line;
  handleInput(processed);
});

saveBtn?.addEventListener("click", async () => {
  console.log("SAVE_CLICKED");

  const text = textarea.value.trim();
  if (!text) return;

  const cmd = parseCommand(text);
  const key = resolveKey(cmd);

  console.log("CMD:", cmd);
  console.log("KEY:", key);
  console.log("STATE:", state);

// state更新は常に実行
syncState(state, cmd, key, getNumbers);

if (!key) {
  console.log("WARN: key is null but state updated");
}

  // ① ローカル反映はここ（必要）
  if (cmd.type !== "delete" && cmd.nums?.length) {
    add(key, cmd.nums);
  }

  commit(key);

  // ② Firestore（ここはOK）
// ② Firestore（修正版）
try {
  const context = {
    grade: state.grade,
    classNum: state.classNum
  };

  const rows = [
    {
      student: cmd.nums?.[0] || 1,
      rate: 0,
      submitted: cmd.nums || [],
      missing: [],
      submittedCount: cmd.nums?.length || 0,
      totalHw: 1
    }
  ];

  await publishStudentSummaryToFirestore(rows, context);

} catch (e) {
  console.error("FIRESTORE_SAVE_ERROR:", e);
}

  console.log("BEFORE_RESET_STATE:", state);

  lastSavedText = text;
  lastSavedSignature = key;

  keepInputReset();
  resetSpeechMemory();
  renderHistory();
  safeRender(state);
});

resetTextBtn?.addEventListener("click", () => {
  resetTextInputOnly();
});

clearAllDataBtn?.addEventListener("click", () => {
  const ok = confirm("全てのデータを削除します。\n元に戻せません。本当に実行しますか？");
  if (!ok) {
    return;
  }

  clearAllData();
  resetRuntimeMemory();
  resetInput();
  resetSpeechMemory();
  renderHistory();
  currentSummary = null;
  currentSummaryContext = null;
  renderSummaryTable([]);
});

exportCsvBtn.addEventListener("click", () => {
  exportCsv();
});

exportStudentHtmlBtn?.addEventListener("click", () => {
  if (!Array.isArray(currentSummary) || currentSummary.length === 0) {
    return;
  }

  if (currentSummary[0]?.student === undefined) {
    return;
  }

  downloadHtml("student-summary.html", buildStudentShareHtml(currentSummary));
});

firestoreLoginBtn?.addEventListener("click", async () => {
  try {
    const { signInAdmin } = await loadFirebaseBackupModule();
    const user = await signInAdmin();
    setFirestoreStatus(user);
    alert("管理者ログイン成功");
  } catch {
    alert("管理者ログイン失敗。Firebase Authentication設定を確認してください。");
  }
});

firestoreLogoutBtn?.addEventListener("click", async () => {
  try {
    const { logoutAdmin } = await loadFirebaseBackupModule();
    await logoutAdmin();
    setFirestoreStatus(null);
    alert("ログアウトしました");
  } catch {
    alert("ログアウト失敗。もう一度試してください。");
  }
});

firestoreBackupBtn?.addEventListener("click", async () => {
  try {
    const { backupLocalDataToFirestore, getCurrentUser } = await loadFirebaseBackupModule();
    if (!getCurrentUser()) {
      alert("先に管理者ログインしてください。");
      return;
    }

    const homeworkMap = JSON.parse(localStorage.getItem("homeworkMap") || "{}");
    const homeworkHistory = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");

    await backupLocalDataToFirestore({
      homeworkMap,
      homeworkHistory,
      createdAt: new Date(),
      appVersion: "localStorage-backup-v1"
    });

    alert("Firestoreバックアップ成功");
  } catch {
    alert("Firestoreバックアップ失敗。接続設定やFirestoreルールを確認してください。");
  }
});

publishStudentShareBtn?.addEventListener("click", async () => {
  try {
    if (!Array.isArray(currentSummary) || currentSummary.length === 0 || currentSummary[0]?.student === undefined) {
      alert("先に生徒別集計を表示してください。");
      return;
    }

    const { getCurrentUser, publishStudentSummaryToFirestore } = await loadFirebaseBackupModule();
    if (!getCurrentUser()) {
      alert("先に管理者ログインしてください。");
      return;
    }

    await publishStudentSummaryToFirestore(currentSummary, currentSummaryContext);
    alert("生徒公開データをFirestoreへ保存しました");
  } catch {
    alert("生徒公開データの保存に失敗しました。ログイン状態やFirestoreルールを確認してください。");
  }
});

loadFirebaseBackupModule()
  .then(({ watchAuthState }) => {
    watchAuthState(setFirestoreStatus);
  })
  .catch(() => {
    setFirestoreStatus(null);
  });

textarea.addEventListener("blur", () => {
  if (state.isLocked) {
    return;
  }

  setTimeout(() => textarea.focus(), 0);
});

setInterval(() => {
  if (state.isLocked) {
    return;
  }

  if (document.activeElement !== textarea) {
    textarea.focus();
  }
}, 3000);

window.onload = () => {
  initApp();
};



function initApp() {
  loadFromLocalStorage(state); // ←これに変更
  startSpeech();
  safeRender(state);
}


function getCurrentKey() {
  return null;
}

function render(state) {
  renderState(state);
  renderMetaControls();
  renderList(null); // state使うな
}
setSpeechHandler(handleInput);

textarea.focus();
