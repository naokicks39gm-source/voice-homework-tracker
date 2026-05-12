export function createInitialState() {
  return {
    grade: null,
    classId: null,
    homeworkNo: null,
    submitted: new Set(),
    isLocked: false,
    lastProcessedLine: ""
  };
}

export function syncState(state, cmd, key, getNumbers) {
  state.grade = cmd.grade ?? state.grade;
  state.classId = cmd.classNum ?? state.classId;
  state.homeworkNo = cmd.hw ?? state.homeworkNo;
  state.submitted = new Set(getNumbers(key) || []);
}
