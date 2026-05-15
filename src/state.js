export function createState() {
  return {
    grade: null,
    classId: null,
    homeworkNo: null,
    submitted: new Set(),
    isLocked: false,
    lastProcessedLine: "",
    lastProcessedText: "",
    lastSavedText: ""
  };
}

export function applyCmdToState(cmd, submittedNumbers = []) {
  state = {
    ...state,
    grade: cmd.grade ?? state.grade,
    classNum: cmd.classNum ?? state.classNum,
    hw: cmd.hw ?? state.hw,
    classId: cmd.classNum ?? state.classId,
    homeworkNo: cmd.hw ?? state.homeworkNo,
    submitted: new Set(submittedNumbers)
  };
}

let state = createState();

export function getState() {
  return state;
}

export function setState(patch) {
  state = {
    ...state,
    ...patch
  };
}

export function resetState() {
  state = createState();
}