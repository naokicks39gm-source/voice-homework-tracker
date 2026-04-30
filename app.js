import { getLastLine, normalizeText } from "./normalizer.js";
import { parseCommand } from "./parser.js";
import { add, commit, getKey, getNumbers, loadFromLocalStorage, remove, submit } from "./storage.js";
import { setSpeechHandler, startSpeech } from "./speech.js";
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

function includesSave(text) {
  return normalizeText(text).includes("保存");
}

function keepInputReset() {
  resetInput();
  setTimeout(resetInput, 0);
  setTimeout(resetInput, 50);
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

export function handleInput(text) {
  if (text === lastProcessedText) {
    return;
  }

  lastProcessedText = text;

  const cmd = parseCommand(text);
  console.log("DEBUG_CMD", JSON.stringify({ text, cmd }));
  const key = resolveKey(cmd);
  if (cmd.type === "save" && !key) {
    console.log("DEBUG_SKIP_INVALID_SAVE", JSON.stringify({ text, cmd }));
    keepInputReset();
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
    console.log("DEBUG_SUBMIT", JSON.stringify({
      key,
      submitted: getNumbers(key)
    }));
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
    console.log("DEBUG_SAVE", key);

    if (cmd.nums?.length) {
      add(key, cmd.nums);
    }

    commit(key);
    keepInputReset();
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

  const raw = textarea.value;
  const line = normalizeText(getLastLine(raw));

  if (line === state.lastProcessedLine) {
    return;
  }

  state.lastProcessedLine = line;
  handleInput(raw);

  if (includesSave(raw)) {
    keepInputReset();
  }
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
