import { getLastLine, normalizeText } from "./normalizer.js";
import { parseCommand } from "./parser.js?v=20260502-student-summary-01";
import {
  add,
  clearAllData,
  commit,
  getKey,
  getNumbers,
  loadFromLocalStorage,
  remove,
  submit
} from "./storage.js?v=20260502-reset-01";
import { resetSpeechMemory, setSpeechHandler, startSpeech } from "./speech.js?v=20260502-logs-01";
import { buildStudentSummary, buildSummary } from "./summary.js?v=20260504-csv-01";
import {
  downloadCsv,
  downloadHtml,
  renderHistory,
  renderList,
  renderState,
  renderStudentSummaryTable,
  renderSummaryTable
} from "./ui.js?v=20260508-student-html-01";

import { publishStudentSummaryToFirestore } from "./firebaseBackup.js";

// ★追加：state管理を外部化
import { getState, setState } from "./src/state.js";

import { handleDelete } from "./src/commands/delete.js";
import { preprocessInput, buildCommand } from "./src/input/processor.js";

import {
  renderMetaControls,
  setFirestoreStatus
} from "./ui.js";

async function loadFirebaseBackupModule() {
  return import("./firebaseBackup.js?v=20260508-student-public-01");
}

const YEARS = [2024, 2025, 2026];

const inputState = {
  year: "2026"
};
renderMetaControls(inputState, YEARS);

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

let lastProcessedText = "";
let lastSavedText = "";
let lastSavedSignature = "";
let lastDebugCmdSignature = "";
let currentSummary = null;
let currentSummaryContext = null;
let saveLock = false;

function updateSubmittedState(key) {
  setState({
    ...getState(),
    submitted: new Set(getNumbers(key))
  });
}

function applyCommand(cmd, key) {
  if (!key) return;

  if (cmd.type === "submit") {
    submit(key, cmd.nums);
  }

  if (cmd.type === "add") {
    add(key, cmd.nums);
  }

  if (cmd.type === "delete") {
    remove(key, cmd.nums);
  }

  // state更新はここに集約
  setState({
    ...getState(),
    submitted: new Set(getNumbers(key) || [])
  });
}

function renderCurrent(key) {
  renderState(getState()); // ★変更
  renderList(key);
}

function resetInput({ key, resetGuards = false } = {}) {
  textarea.value = "";

  setState({
    submitted: new Set(getNumbers(key) || []),
    grade: null,
    classId: null,
    homeworkNo: null,
    lastProcessedLine: ""
  });

  if (resetGuards) {
    resetRuntimeMemory();
  }
}

function resolveKey(cmd) {
  const state = getState();

  const grade = cmd.grade ?? getState().grade;
  const classNum = cmd.classNum ?? state.classNum ?? getState().classId;
  const hw = cmd.hw ?? getState().hw ?? state.homeworkNo;

  if (!grade || !classNum || !hw) {
    return null;
  }

  return getKey({ grade, classNum, hw });
}

export function applyCmdToState(cmd, submittedNumbers = []) {
  const current = getState();

  setState({
    grade: cmd.grade ?? current.grade,
    classNum: cmd.classNum ?? current.classNum,
    hw: cmd.hw ?? current.hw,
    classId: cmd.classNum ?? current.classId,
    homeworkNo: cmd.hw ?? current.homeworkNo,
    submitted: new Set(submittedNumbers)
  });
}

/* =========================================================
   ↓↓↓ ここから下は基本ロジック未変更（安全のため）
   ========================================================= */

function extractNewPart(raw, last) {
  if (!last) return raw;
  if (raw.startsWith(last)) return raw.slice(last.length).trim();

  const index = raw.lastIndexOf(last);
  if (index !== -1) return raw.slice(index + last.length).trim();

  return raw;
}

function logDebugCommand(cmd, key) {
  const signature = `${cmd.type}:${key ?? ""}`;
  if (signature === lastDebugCmdSignature) return;
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
  renderCurrent(null);
  textarea.focus();
}

/* =========================================================
   INPUT HANDLER（ここは最小変更）
   ========================================================= */

export function handleInput(text) {
const input = preprocessInput(text);
if (!input) return;

const { cmd, key } = buildCommand(input, resolveKey);
if (!cmd || cmd.type === "noop" || !key) return;

executeCommand(cmd, key);
}



async function executeCommand(cmd, key, { save = false } = {}) {
if (cmd.type === "delete") {
handleDelete(cmd, key);
} else if (cmd.nums?.length) {
applyCommand(cmd, key);
}

if (save) {
commit(key);
}

renderCurrent(key);
}
/* =========================================================
   EVENT HANDLERS（state直参照を排除）
   ========================================================= */

textarea.addEventListener("input", () => {
  const state = getState(); // ★追加

  if (state.isLocked) return;

  const raw = textarea.value.trim();
  let processed = raw;

  if (lastSavedText && raw.indexOf(lastSavedText) !== -1) {
    processed = extractNewPart(raw, lastSavedText);
    textarea.value = processed;
  }

  const value = processed.trim();
  if (value && value === lastProcessedText) return;

  const line = normalizeText(getLastLine(processed));

  if (line === getState().lastProcessedLine) return;

  setState({
    ...state,
    lastProcessedLine: line
  });

  handleInput(processed);
});

/* =========================================================
   saveBtn / firestore / UI は最小変更のみ
   ========================================================= */

saveBtn?.addEventListener("click", async () => {
  const text = textarea.value.trim();
  if (!text) return;

  const cmd = parseCommand(text);
  const key = resolveKey(cmd);
  if (!key) return;

  await executeCommand(cmd, key, { save: true });

  resetInput({ key });
  resetSpeechMemory();
  renderHistory();
});

/* =========================================================
   その他イベント（元コードそのまま維持）
   ========================================================= */

saveBtn?.addEventListener("click", async () => {
  console.log("SAVE_CLICKED");

  const state = getState();

  const text = textarea.value.trim();
  if (!text) return;

  const cmd = parseCommand(text);
  const key = resolveKey(cmd);

  console.log("CMD:", cmd);
  console.log("KEY:", key);
  console.log("STATE:", state);

  if (!key) return;

  // ① ローカル反映はここ（必要）
  if (cmd.type !== "delete" && cmd.nums?.length) {
    applyCommand(cmd, key);
  }

  commit(key);

  // ② Firestore（ここはOK）
  try {
    const context = {
      grade: getState().grade,
      classNum: getState().classId
    };

    const rows = [
      {
        student: cmd.nums?.[0] || 1,
        rate: 0,
        submitted: getNumbers(key) || [],
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
  renderCurrent(key);
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
  renderCurrent(null);
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
  const state = getState();

  if (state.isLocked) {
    return;
  }

  setTimeout(() => textarea.focus(), 0);
});


setInterval(() => {
  const state = getState();

  if (state.isLocked) {
    return;
  }

  if (document.activeElement !== textarea) {
    textarea.focus();
  }
}, 3000);


window.onload = () => {
  loadFromLocalStorage();
  textarea.focus();
  setTimeout(() => textarea.focus(), 100);
  renderCurrent(null);
  renderHistory();
  startSpeech();
};


setSpeechHandler(handleInput);

textarea.focus();
renderCurrent(null);
renderMetaControls(inputState, YEARS);