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