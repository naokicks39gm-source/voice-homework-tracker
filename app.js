import { getLastLine, normalizeText } from "./normalizer.js";
import { parseCommand } from "./parser.js?v=20260502-student-summary-01";
import { add, clearAllData, commit, getKey, getNumbers, loadFromLocalStorage, remove, submit } from "./storage.js?v=20260502-reset-01";
import { resetSpeechMemory, setSpeechHandler, startSpeech } from "./speech.js?v=20260502-logs-01";
import { buildStudentSummary, buildSummary } from "./summary.js?v=20260522-emergency-fixed-v1";
import { downloadCsv, downloadHtml, renderHistory, renderList, renderStudentSummaryTable, renderSummaryTable ,renderClassButtons } from "./ui.js?v=20260508-student-html-01";
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
    isLocked: false,
    lastProcessedLine: "",
    lastNums: []
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
console.log("STATE RESET DETECTED");
let state = createInitialState();
let lastProcessedText = "";
let lastSavedText = "";
let lastSavedSignature = "";
let lastDebugCmdSignature = "";
let currentSummary = null;
let currentSummaryContext = null;
let saveLock = false;
let hasAutoSynced = false;


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
  focusTextarea()
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

// app.js の updateState を以下のように修正してください
function updateState(cmd) {
  if (cmd.grade != null) state.grade = Number(cmd.grade);
  if (cmd.classNum != null) state.classNum = Number(cmd.classNum);
  
  // 【修正】Number変換をせず、文字列のまま受け入れる
  if (cmd.hw != null) {
    state.hw = cmd.hw; 
  }

  if (cmd.nums?.length) state.lastNums = cmd.nums;
}

// 📦 ローカルストレージ内の可能性のある全種類の履歴キーからデータをサルベージする安全関数
function loadHistorySafely() {
  const keys = ["homeworkHistory", "homework_history", "history"];
  for (const k of keys) {
    try {
      const data = localStorage.getItem(k);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[DEBUG] 履歴データをキー「${k}」から正常にロードしました。件数: ${parsed.length}`);
          return parsed;
        }
      }
    } catch (e) {}
  }
  
  // 💡 もし上記配列形式が全滅していた場合、単一のマップオブジェクトから擬似履歴を復元する超強力フォールバック
  try {
    const mapData = localStorage.getItem("homeworkMap") || localStorage.getItem("homework_map");
    if (mapData) {
      const parsedMap = JSON.parse(mapData);
      const generatedHistory = Object.keys(parsedMap).map(key => {
        // 例: "1-1-宿題6" のオブジェクトから配列を取り出す
        const entry = parsedMap[key];
        let nums = [];
        if (Array.isArray(entry)) nums = entry;
        else if (entry && Array.isArray(entry.nums)) nums = entry.nums;
        else if (entry && typeof entry === "object") {
          nums = Object.keys(entry).filter(k => entry[k]).map(Number);
        }
        return { key, nums, timestamp: Date.now() };
      });
      if (generatedHistory.length > 0) {
        console.log(`[DEBUG] homeworkMapから履歴を自己修復生成しました。件数: ${generatedHistory.length}`);
        return generatedHistory;
      }
    }
  } catch (e) {}

  return [];
}


export function handleInput(text, isInputEvent = false) {
  console.log("handleInput", text);

  const rawText = String(text || "");
  if (rawText === "__RESET_DONE__") return;

  // 前処理
  let processed = rawText.trim().replace(/^リセット[。、「」\s]*/, "");

  if (lastSavedText && processed.includes(lastSavedText)) {
    processed = extractNewPart(processed, lastSavedText);
  }

  if (!processed) return;

  // 音声入力イベント（あるいは保存中）の時は、textareaの値を手動で書き換えない（暴走・増殖ループを防止！）
  if (!isInputEvent && textarea.value !== processed) {
    console.log("[DEBUG] スキップされた手動代入:", processed);
  } else if (textarea.value !== processed) {
    textarea.value = processed;
  }

  // 保存ワードまで切り出し
  const normalizedText = normalizeText(processed);
  const rawSaveIndex = processed.indexOf("保存");
  const normalizedSaveIndex = normalizedText.indexOf("保存");

  if (rawSaveIndex !== -1 || normalizedSaveIndex !== -1) {
    const base = rawSaveIndex !== -1 ? processed : normalizedText;
    processed = base.slice(0, (rawSaveIndex !== -1 ? rawSaveIndex : normalizedSaveIndex) + 2);
  }

  // 📋 コマンド解析（重複ガードより前に実行し、最新の声を常にキャッチする）
  const cmd = parseCommand(processed);
  updateState(cmd); 
  const key = resolveKey(cmd);
  
  console.log("DEBUG CMD:", cmd);
  console.log("DEBUG NUMS:", cmd.nums);
  console.log("CMD:", cmd);
  console.log("KEY:", key);
  console.log("STATE:", state);

  logDebugCommand(cmd, getDebugKey(cmd, key));

  // ✨【最重要：集計コマンドの救出】重複ガードの前に実行することで、集計表示を確実に即座に発火させる！
  if (cmd.type === "studentSummary") {
    // 🛠️【超防弾修正】フォールバック関数から確実に実データを取得
    const history = loadHistorySafely();
    currentSummary = buildStudentSummary(history, cmd.grade, cmd.classNum, cmd.size);
    currentSummaryContext = { grade: cmd.grade, classNum: cmd.classNum };
    safeRender(state);
    return; // 👈 集計が動いたらここで即時終了（暴走させない）
  }

  if (cmd.type === "summary") {
    const grade = cmd.grade ?? state.grade;
    const classNum = cmd.classNum ?? state.classNum;

    if (!grade || !classNum || !cmd.size) {
      currentSummary = [];
      currentSummaryContext = null;
      safeRender(state);
      return;
    }

    // 🛠️【超防弾修正】フォールバック関数から確実に実データを取得
    const history = loadHistorySafely();
    currentSummary = buildSummary(history, grade, classNum, cmd.size);
    currentSummaryContext = { grade, classNum };
    safeRender(state);
    return; // 👈 集計が動いたらここで即時終了（暴走させない）
  }

  // 🛡️ 提出・削除系の重複処理防止（集計コマンドの後にガードをかける）
  if (processed === lastProcessedText) {
    // 全く同じテキストでも、入力途中の提出番号（submitted）の記入・描画だけは更新しておく
    safeRender(state);
    return;
  }
  lastProcessedText = processed;

  if (cmd.type === "noop") return;

  // ===== save異常 =====
  if (cmd.type === "save" && !key) {
    print("DEBUG_SKIP_INVALID_SAVE", JSON.stringify({ processed }));
    keepInputReset();
    resetSpeechMemory();
    safeRender(state);
    return;
  }

  if (!key) return;

  // ===== submit =====
  if (cmd.type === "submit") {
    const key = resolveKey(cmd);
    if (!key) return;

    if (!cmd.nums?.length && state.lastNums?.length) {
      cmd.nums = state.lastNums;
    }

    if (!cmd.nums?.length) return;

    submit(key, cmd.nums);
    safeRender(state);
    return;
  }

  // ===== add =====
  if (cmd.type === "add") {
    saveLock = false;
    add(key, cmd.nums);
    safeRender(state);
    return;
  }

  // ===== delete =====
  if (cmd.type === "delete") {
    saveLock = false;
    remove(key, cmd.nums);
    safeRender(state);
    return;
  }

 

  // ===== その他 =====
  saveLock = false;
  safeRender(state);
}
let inputTimer = null;
let lastKeyProcessed = null;

textarea.addEventListener("input", () => {
  clearTimeout(inputTimer);

  const text = textarea.value;

  inputTimer = setTimeout(() => {
    const processed = normalizeText(text);

    if (!processed) return;

    // ✨【修正】「提出」だけでなく「生徒別」や「集計」のコマンドも通すように門番を拡張！
    if (!processed.includes("提出") && !processed.includes("生徒別") && !processed.includes("集計")) return;

    processInput(processed);
  }, 500);
});


saveBtn?.addEventListener("click", async () => {
  console.log("SAVE_CLICKED");

  const text = textarea.value.trim();
  if (!text) return;

  const cmd = parseCommand(text);
  const safe = normalizeCmd(cmd, state);
  const key = resolveKey(safe);

  console.log("CMD:", cmd);
  console.log("SAFE:", safe);
  console.log("KEY:", key);
  console.log("STATE:", state);

  // ① keyが取れないなら即終了（ここ曖昧にするな）
  if (!key) {
    console.error("FATAL: key is null");
    return;
  }

  // ② state更新（ここが本体）
  if (safe.type !== "delete" && safe.nums?.length) {
    add(key, safe.nums);
  }

  if (safe.type === "delete" && safe.nums?.length) {
    remove(key, safe.nums);
  }

  // ③ commitは更新後のみ
  commit(key);

  // ④ Firestore（safeのみ使う）
  try {
    const context = {
      grade: safe.grade,
      classNum: safe.classNum
    };

    const rows = safe.nums.map((n) => ({
      student: n,
      rate: 0,
      missing: [],
      totalHw: 1
    }));

    await publishStudentSummaryToFirestore(rows, context);
  } catch (e) {
    console.error("FIRESTORE_SAVE_ERROR:", e);
  }

// ⑤【修正・防弾仕様】ローカルストレージのすべての歴史キーに同期させて保存する
  try {
    const keys = ["homeworkHistory", "homework_history", "history"];
    let currentHistory = loadHistorySafely();
    
    // 💡 今回保存する出席番号を、判定と保存の前にあらかじめ昇順ソートしておく
    const sortedNums = Array.isArray(safe.nums) 
      ? [...safe.nums].sort((a, b) => Number(a) - Number(b)) 
      : [];

    // 直近の履歴（最後の要素）を取得
    const lastItem = currentHistory[currentHistory.length - 1];
    
    // 💡 比較時もソート済みの「sortedNums」を使用することで、2重書き込みを100%完璧に防ぐ
    const isDuplicate = lastItem && 
                        lastItem.key === key && 
                        JSON.stringify(lastItem.nums) === JSON.stringify(sortedNums);

    if (isDuplicate) {
      console.log("🛡️ 重複を検知したため、2回目の履歴書き込みをスキップしました");
    } else {
      currentHistory.push({
        key: key,
        nums: sortedNums, // 昇順ソート済みの配列を保存
        timestamp: Date.now()
      });
      // すべての可能性のあるキーに一重書きしてズレを撲滅
      keys.forEach(k => {
        localStorage.setItem(k, JSON.stringify(currentHistory));
      });
      console.log("🔥 HISTORY_WRITE_SUCCESS_EXPLICIT_WITH_NUMS:", sortedNums);
    }
  } catch (err) {
    console.error("HISTORY_WRITE_FAILED:", err);
  }
  console.log("BEFORE_RESET_STATE:", state);

  lastSavedText = text;
  lastSavedSignature = key;

  // ✨【完全修正】保存が確定したら、引き継ぎ用の古い出席番号メモリを完全にクリアする！
  state.lastNums = [];

  // 💥 割り込みイベント（handleInput）のパルスを完全にやり過ごすために、描画処理を一瞬遅らせる（0ミリ秒の非同期キューに入れる）
  keepInputReset();
  resetSpeechMemory();

  setTimeout(() => {
    console.log("🚀 FORCED_FINAL_RENDER_START");
    safeRender(state);
    if (typeof renderHistory === "function") {
      renderHistory(); // 👈 念押しで履歴をもう一度強制発火
    }
  }, 50); 
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
  currentSummary = null;
  currentSummaryContext = null;
  safeRender(state);
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





// 「Firestoreバックアップ」ボタンのイベントリスナーは削除し、
// こちらの処理に統合します
publishStudentShareBtn?.addEventListener("click", async () => {
  try {
    // 1. 公開データ用のバリデーション（公開処理に必要なチェック）
    if (!Array.isArray(currentSummary) || currentSummary.length === 0 || currentSummary[0]?.student === undefined) {
      alert("先に生徒別集計を表示してください。");
      return;
    }

    const { getCurrentUser, backupLocalDataToFirestore, publishStudentSummaryToFirestore } = await loadFirebaseBackupModule();
    
    // 2. ログインチェック
    if (!getCurrentUser()) {
      alert("先に管理者ログインしてください。");
      return;
    }

    // 3. バックアップ処理の実行
    const homeworkMap = JSON.parse(localStorage.getItem("homeworkMap") || "{}");
    const homeworkHistory = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");
    
    await backupLocalDataToFirestore({
      homeworkMap,
      homeworkHistory,
      createdAt: new Date(),
      appVersion: "localStorage-backup-v1"
    });
    console.log("バックアップ完了");

    // 4. 生徒公開データの保存
    await publishStudentSummaryToFirestore(currentSummary, currentSummaryContext);
    
    alert("バックアップと公開データの保存が完了しました！");
  } catch (error) {
    console.error(error);
    alert("処理に失敗しました。ログイン状態やネットワークを確認してください。");
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

  setTimeout(() => focusTextarea(), 0);
});

setInterval(() => {
  if (state.isLocked) {
    return;
  }

  if (document.activeElement !== textarea) {
    focusTextarea();
  }
}, 3000);

window.onload = () => {
  initApp();
};



function initApp() {
  state = {
  ...state,
  ...loadFromLocalStorage()
}; // ←これに変更
  startSpeech();
  // 💡 ボタン生成はここで一度だけ実行する！
  renderClassButtons((grade, classNum) => {
    const history = loadHistorySafely();

// もし history が空なら集計が動かないのでログを出す
  console.log("集計用履歴データ:", history);

    currentSummary = buildStudentSummary(history, grade, classNum, null);
    currentSummaryContext = { grade, classNum };
    console.log("集計データを生成しました:", currentSummary);
    render(state);
  });
  safeRender(state);
}


function getCurrentKey() {
  return null;
}

function render(state) {
  console.log("render 実行中...");
  renderMetaControls();
  renderHistory();

  const publishBtn = document.getElementById("publishStudentShareBtn");

  if (currentSummary && typeof renderStudentSummaryTable === "function") {
    console.log("表を描画します");
    renderStudentSummaryTable(currentSummary, currentSummaryContext);
    
    
      // --- ここから自動同期ロジック ---
      if (!hasAutoSynced) {
        hasAutoSynced = true; // 一度実行したらフラグを立てる
        console.log("自動バックアップ＆公開を開始します...");
        publishBtn.click(); // ボタンのクリックイベントをプログラムから発火
      }
      // --- ここまで ---
    
  } else {
    console.log("表は描画されません");
    
    // 集計がリセットされたらフラグもリセットする（次の集計でまた自動同期させるため）
    hasAutoSynced = false; 
    
  }
}
setSpeechHandler(handleInput);

focusTextarea();


function processInput(text) {
  handleInput(text);
}

function doSubmit(cmd) {
  const safe = normalizeCmd(cmd, state);

  const payload = {
    grade: safe.grade,
    classNum: safe.classNum,
    hw: safe.hw,
  };

  console.log("SUBMIT PAYLOAD:", payload);
}
function focusTextarea() {
  requestAnimationFrame(() => {
    if (document.activeElement !== textarea) {
      textarea.focus();
    }
  });
}
// app.js の normalizeCmd を修正
function normalizeCmd(cmd, prevState) {
  return {
    grade: Number.isFinite(cmd.grade) ? cmd.grade : prevState.grade,
    classNum: Number.isFinite(cmd.classNum) ? cmd.classNum : prevState.classNum,
    // 【修正】hw を数字変換せず、そのまま保持する
    hw: cmd.hw ?? prevState.hw, 
    nums: Array.isArray(cmd.nums) ? cmd.nums : []
  };
}