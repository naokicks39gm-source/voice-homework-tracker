import { getLastLine, normalizeText } from "./normalizer.js";
import { parseCommand } from "./parser.js?v=20260502-student-summary-01";
import { add, clearAllData, commit, getKey, getNumbers, loadFromLocalStorage, remove, submit } from "./storage.js?v=20260502-reset-01";
import { resetSpeechMemory, setSpeechHandler, startSpeech } from "./speech.js?v=20260502-logs-01";
import { buildStudentSummary, buildSummary } from "./summary.js?v=20260504-csv-01";
import { downloadCsv, renderHistory, renderList, renderState, renderStudentSummaryTable, renderSummaryTable } from "./ui.js?v=20260504-csv-current-02";

function createInitialState() {
  return {
    grade: null,
    classId: null,
    homeworkNo: null,
    submitted: new Set(),
    isLocked: false,
    lastProcessedLine: ""
  };
}

const textarea = document.getElementById("speechText");
const clearAllDataBtn = document.getElementById("clearAllDataBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
let state = createInitialState();
let lastProcessedText = "";
let lastSavedText = "";
let lastSavedSignature = "";
let lastDebugCmdSignature = "";
let currentSummary = null;
let currentSummaryContext = null;
let saveLock = false;

function renderCurrent(key) {
  renderState(state);
  renderList(key);
}

function resetInput() {
  const input = document.getElementById("speechText");
  if (input) {
    input.value = "";
  }
  state.submitted = new Set();
  state.grade = null;
  state.classId = null;
  state.homeworkNo = null;
  state.lastProcessedLine = "";
}

function keepInputReset() {
  resetInput();
}

function resolveKey(cmd) {
  const grade = cmd.grade ?? state.grade;
  const classNum = cmd.classNum ?? state.classId;
  const hw = cmd.hw ?? state.homeworkNo;

  if (!grade || !classNum || !hw) {
    return null;
  }

  return getKey({ grade, classNum, hw });
}

function syncState(cmd, key) {
  state.grade = cmd.grade ?? state.grade;
  state.classId = cmd.classNum ?? state.classId;
  state.homeworkNo = cmd.hw ?? state.homeworkNo;
  state.submitted = new Set(getNumbers(key));
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
  console.log("DEBUG_CMD", JSON.stringify({
    type: cmd.type,
    key
  }));
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

function escapeCsvValue(value) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll("\"", "\"\"")}"`;
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
  console.log("CSV_START");
  console.log("CSV_STATE_EXISTS", !!currentSummary);

  if (!currentSummary) {
    console.log("CSV_ABORT_NO_STATE");
    return;
  }

  console.log("CSV_STATE_SAMPLE", JSON.stringify(currentSummary[0] || null));

  if (!Array.isArray(currentSummary) || currentSummary.length === 0) {
    console.log("CSV_ABORT_EMPTY_STATE");
    return;
  }

  const csvText = buildCsvText(currentSummary, currentSummaryContext);
  console.log("CSV_TEXT_LENGTH", csvText.length);
  const filename = "homework-summary.csv";
  console.log("CSV_CALL_DOWNLOAD");
  downloadCsv(filename, csvText);
}

export function handleInput(text) {
  const normalizedText = normalizeText(text);
  const rawSaveIndex = text.indexOf("保存");
  const normalizedSaveIndex = normalizedText.indexOf("保存");
  const saveIndex = rawSaveIndex !== -1 ? rawSaveIndex : normalizedSaveIndex;
  if (saveIndex !== -1) {
    text = (rawSaveIndex !== -1 ? text : normalizedText).slice(0, saveIndex + 2);
  }

  if (text === lastProcessedText) {
    return;
  }

  lastProcessedText = text;

  const cmd = parseCommand(text);
  const key = resolveKey(cmd);
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
    console.log("CSV_SET_STUDENT_SUMMARY", rows.length);
    renderStudentSummaryTable(rows);
    return;
  }

  if (cmd.type === "summary") {
    const grade = cmd.grade ?? state.grade;
    const classNum = cmd.classNum ?? state.classId;
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
    console.log("CSV_SET_SUMMARY", rows.length);
    renderSummaryTable(rows);
    return;
  }

  if (cmd.type === "save" && !key) {
    console.log("DEBUG_SKIP_INVALID_SAVE", JSON.stringify({ text }));
    keepInputReset();
    resetSpeechMemory();
    renderHistory();
    renderCurrent(null);
    return;
  }

  if (!key) {
    renderCurrent(null);
    return;
  }

  if (cmd.type === "submit") {
    saveLock = false;
    submit(key, cmd.nums);
    syncState(cmd, key);
    renderCurrent(key);
    return;
  }

  if (cmd.type === "add") {
    saveLock = false;
    add(key, cmd.nums);
    syncState(cmd, key);
    renderCurrent(key);
    return;
  }

  if (cmd.type === "delete") {
    saveLock = false;
    remove(key, cmd.nums);
    syncState(cmd, key);
    renderCurrent(key);
    return;
  }

  if (cmd.type === "save") {
    if (typeof key !== "string" || !/^\d+-\d+-宿題\d+$/.test(key)) {
      return;
    }

    if (saveLock) {
      return;
    }

    if (cmd.nums?.length) {
      add(key, cmd.nums);
    }

    const savedNums = getNumbers(key).slice().sort((a, b) => a - b);
    const signature = `${key}:${savedNums.join(",")}`;

    if (signature === lastSavedSignature) {
      return;
    }

    saveLock = true;
    console.log("DEBUG_SAVE", key);

    commit(key);
    lastSavedText = text;
    lastSavedSignature = signature;
    keepInputReset();
    resetSpeechMemory();
    renderHistory();
    renderCurrent(key);
    return;
  }

  saveLock = false;
  syncState(cmd, key);
  renderCurrent(key);
}

textarea.addEventListener("input", () => {
  if (state.isLocked) {
    return;
  }

  const raw = textarea.value.trim();
  let processed = raw;
  if (lastSavedText && raw.includes(lastSavedText)) {
    processed = extractNewPart(raw, lastSavedText);
    textarea.value = processed;

    if (!processed) {
      return;
    }
  }

  const value = processed.trim();
  if (value === lastProcessedText) {
    return;
  }

  const line = normalizeText(getLastLine(processed));

  if (line === state.lastProcessedLine) {
    return;
  }

  state.lastProcessedLine = line;
  handleInput(processed);
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
  console.log("CSV_CLICK");
  exportCsv();
});
console.log("CSV_EVENT_BOUND");

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
