import { getLastLine, normalizeText } from "./normalizer.js";
import { parseCommand } from "./parser.js";
import { add, commit, getKey, getNumbers, loadFromLocalStorage, remove, submit } from "./storage.js";
import { resetSpeechMemory, setSpeechHandler, startSpeech } from "./speech.js?v=20260502-trace-01";
import { renderHistory, renderList, renderState } from "./ui.js";

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
let state = createInitialState();
let lastProcessedText = "";
let lastSavedText = "";
let __TRACE_ID = 0;

function renderCurrent(key) {
  renderState(state);
  renderList(key);
}

function resetInput() {
  const input = document.getElementById("speechText");
  console.log("TRACE_RESET_START", JSON.stringify({
    value: input?.value ?? null
  }));
  if (input) {
    input.value = "";
  }
  state.submitted = new Set();
  state.grade = null;
  state.classId = null;
  state.homeworkNo = null;
  state.lastProcessedLine = "";
  console.log("TRACE_RESET_END", JSON.stringify({
    value: input?.value ?? null
  }));
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

export function handleInput(text) {
  const id = ++__TRACE_ID;
  const originalText = text;
  console.log("TRACE_ENTER", JSON.stringify({ id, text: originalText, lastProcessedText }));

  const normalizedText = normalizeText(text);
  const rawSaveIndex = text.indexOf("保存");
  const normalizedSaveIndex = normalizedText.indexOf("保存");
  const saveIndex = rawSaveIndex !== -1 ? rawSaveIndex : normalizedSaveIndex;
  if (saveIndex !== -1) {
    text = (rawSaveIndex !== -1 ? text : normalizedText).slice(0, saveIndex + 2);
  }
  console.log("TRACE_AFTER_CUT", JSON.stringify({ id, text }));

  if (text === lastProcessedText) {
    console.log("TRACE_SKIP_DUPLICATE", JSON.stringify({ id, text }));
    return;
  }

  lastProcessedText = text;

  const cmd = parseCommand(text);
  console.log("DEBUG_CMD", JSON.stringify({ text, cmd }));
  const key = resolveKey(cmd);
  console.log("TRACE_CMD", JSON.stringify({ id, cmd, key }));
  if (cmd.type === "save" && !key) {
    console.log("DEBUG_SKIP_INVALID_SAVE", JSON.stringify({ text, cmd }));
    console.log("TRACE_SKIP_INVALID_SAVE", JSON.stringify({ id, cmd }));
    keepInputReset();
    resetSpeechMemory();
    renderHistory();
    console.log("TRACE_RENDER_HISTORY", JSON.stringify({ id }));
    renderCurrent(null);
    console.log("TRACE_RENDER_LIST", JSON.stringify({ id, key: null }));
    return;
  }

  if (!key) {
    renderCurrent(null);
    console.log("TRACE_RENDER_LIST", JSON.stringify({ id, key: null }));
    return;
  }

  if (cmd.type === "submit") {
    submit(key, cmd.nums);
    syncState(cmd, key);
    console.log("DEBUG_SUBMIT", JSON.stringify({
      key,
      submitted: getNumbers(key)
    }));
    renderCurrent(key);
    console.log("TRACE_RENDER_LIST", JSON.stringify({ id, key }));
    return;
  }

  if (cmd.type === "add") {
    add(key, cmd.nums);
    syncState(cmd, key);
    renderCurrent(key);
    console.log("TRACE_RENDER_LIST", JSON.stringify({ id, key }));
    return;
  }

  if (cmd.type === "delete") {
    remove(key, cmd.nums);
    syncState(cmd, key);
    renderCurrent(key);
    console.log("TRACE_RENDER_LIST", JSON.stringify({ id, key }));
    return;
  }

  if (cmd.type === "save") {
    if (text === lastSavedText) {
      console.log("TRACE_BLOCK_DUPLICATE_SAVE", text);
      return;
    }

    console.log("DEBUG_SAVE", key);
    console.log("TRACE_BEFORE_SAVE", JSON.stringify({ id, key, text }));

    if (cmd.nums?.length) {
      add(key, cmd.nums);
    }

    commit(key);
    lastSavedText = text;
    console.log("TRACE_AFTER_SAVE", JSON.stringify({ id, key }));
    keepInputReset();
    console.log("TRACE_AFTER_RESET", JSON.stringify({ id }));
    resetSpeechMemory();
    renderHistory();
    console.log("TRACE_RENDER_HISTORY", JSON.stringify({ id }));
    renderCurrent(key);
    console.log("TRACE_RENDER_LIST", JSON.stringify({ id, key }));
    return;
  }

  syncState(cmd, key);
  renderCurrent(key);
  console.log("TRACE_RENDER_LIST", JSON.stringify({ id, key }));
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
    console.log("TRACE_DIFF", JSON.stringify({
      raw,
      lastSavedText,
      processed
    }));

    if (!processed) {
      return;
    }
  }

  const value = processed.trim();
  if (value === lastProcessedText) {
    console.log("TRACE_SKIP_TEXTAREA_DUP");
    return;
  }

  const line = normalizeText(getLastLine(processed));
  console.log("TRACE_TEXTAREA_INPUT", JSON.stringify({
    raw: processed,
    line,
    lastProcessedLine: state.lastProcessedLine
  }));

  if (line === state.lastProcessedLine) {
    console.log("TRACE_TEXTAREA_SKIP_LINE", JSON.stringify({ line }));
    return;
  }

  state.lastProcessedLine = line;
  handleInput(processed);
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
