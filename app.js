import { getLastLine, normalizeText } from "./normalizer.js";
import { parseCommand } from "./parser.js";
import { add, getKey, getNumbers, loadFromLocalStorage, remove, submit } from "./storage.js";
import { setSpeechHandler } from "./speech.js";
import { renderList, renderState } from "./ui.js";

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

function renderCurrent(key) {
  renderState(state);
  renderList(key);
}

function syncState(cmd, key) {
  state.grade = cmd.grade;
  state.classId = cmd.classNum;
  state.homeworkNo = cmd.hw;
  state.submitted = new Set(getNumbers(key));
}

export function handleInput(text) {
  const cmd = parseCommand(text);

  if (!cmd.grade || !cmd.classNum || !cmd.hw) {
    renderCurrent(null);
    return;
  }

  const key = getKey(cmd);

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
};

setSpeechHandler(handleInput);

textarea.focus();
renderCurrent(null);
