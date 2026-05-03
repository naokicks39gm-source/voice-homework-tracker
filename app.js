import { getLastLine, normalizeText } from "./normalizer.js";
import { parseCommand } from "./parser.js?v=20260502-student-summary-01";
import { add, clearAllData, commit, getKey, getNumbers, loadFromLocalStorage, remove, submit } from "./storage.js?v=20260502-reset-01";
import { resetSpeechMemory, setSpeechHandler, startSpeech } from "./speech.js?v=20260502-logs-01";
import { buildStudentSummary, buildSummary } from "./summary.js?v=20260504-student-rate-01";
import { renderHistory, renderList, renderState, renderStudentSummaryTable, renderSummaryTable } from "./ui.js?v=20260504-student-rate-01";

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
let state = createInitialState();
let lastProcessedText = "";
let lastSavedText = "";
let lastDebugCmdSignature = "";

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
  lastDebugCmdSignature = "";
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
    renderStudentSummaryTable(rows);
    return;
  }

  if (cmd.type === "summary") {
    const grade = cmd.grade ?? state.grade;
    const classNum = cmd.classNum ?? state.classId;
    if (!grade || !classNum || !cmd.size) {
      renderSummaryTable([]);
      return;
    }

    const history = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");
    const rows = buildSummary(history, grade, classNum, cmd.size);
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
    submit(key, cmd.nums);
    syncState(cmd, key);
    renderCurrent(key);
    return;
  }

  if (cmd.type === "add") {
    add(key, cmd.nums);
    syncState(cmd, key);
    renderCurrent(key);
    return;
  }

  if (cmd.type === "delete") {
    remove(key, cmd.nums);
    syncState(cmd, key);
    renderCurrent(key);
    return;
  }

  if (cmd.type === "save") {
    if (text === lastSavedText) {
      return;
    }

    console.log("DEBUG_SAVE", key);

    if (cmd.nums?.length) {
      add(key, cmd.nums);
    }

    commit(key);
    lastSavedText = text;
    keepInputReset();
    resetSpeechMemory();
    renderHistory();
    renderCurrent(key);
    return;
  }

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
  renderSummaryTable([]);
  renderCurrent(null);
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
