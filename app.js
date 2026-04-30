function createInitialState(){
  return {
    grade: null,
    classId: null,
    homeworkNo: null,
    isCollecting: false,
    submitted: new Set(),
    lastSavedText: "",
    isLocked: false,
    lastProcessedLine: "",
    lastClassKey: "",
    lastHomeworkKey: ""
  };
}

let state = createInitialState();

const textarea = document.getElementById("speechText");

window.onload = () => {
  textarea.focus();
  setTimeout(() => textarea.focus(), 100);
};

function submittedEqual(left, right){
  if(left.size !== right.size){
    return false;
  }

  for(const value of left){
    if(!right.has(value)){
      return false;
    }
  }

  return true;
}

function extractAfterSubmit(text){
  const idx = text.indexOf("提出");
  if(idx === -1){
    return "";
  }

  return text.slice(idx);
}

textarea.addEventListener("input", () => {
  if(state.isLocked){
    return;
  }

  const raw = textarea.value;
  const line = normalizeText(getLastLine(raw));

  if(line === state.lastProcessedLine){
    return;
  }

  state.lastProcessedLine = line;
  handleText(line, raw);
});

textarea.addEventListener("blur", () => {
  if(state.isLocked){
    return;
  }

  setTimeout(() => textarea.focus(), 0);
});

setInterval(() => {
  if(state.isLocked){
    return;
  }

  if(document.activeElement !== textarea){
    textarea.focus();
  }
}, 3000);

function handleText(text, raw){
  const fullText = normalizeText(raw);

  if(/保存/.test(fullText)){
    if(!state.grade || !state.classId || !state.homeworkNo){
      return;
    }

    state.lastSavedText = text;
    state.isLocked = true;
    saveData(state);
    textarea.blur();
    textarea.value = "";
    state.grade = null;
    state.classId = null;
    state.homeworkNo = null;
    state.submitted.clear();
    state.isCollecting = false;
    state.lastProcessedLine = "";
    state.lastClassKey = "";
    state.lastHomeworkKey = "";
    setTimeout(() => {
      textarea.focus();
      state.isLocked = false;
    }, 300);

    render(state);
    return;
  }

  const addCmd = parseAddCommand(fullText);
  if(addCmd){
    const data = loadAll();
    const key = makeKey(addCmd.grade, addCmd.classId, addCmd.homeworkNo);
    const idx = data.findIndex((item) => item.key === key);

    if(idx !== -1){
      const set = new Set(data[idx].submitted);
      addCmd.nums.forEach((n) => set.add(n));

      data[idx].submitted = [...set].sort((a, b) => a - b);
      data[idx].updatedAt = Date.now();

      const item = data.splice(idx, 1)[0];
      data.unshift(item);
      saveAll(data);
    }

    render(state);
    return;
  }

  const cls = parseClass(text);
  if(cls){
    const key = `${cls.grade}-${cls.classId}`;

    if(key !== state.lastClassKey){
      state.grade = cls.grade;
      state.classId = cls.classId;
      state.lastClassKey = key;
      console.log("CLASS_PARSED", cls);
    }
  }

  const hw = parseHomework(text);
  if(hw){
    if(hw !== state.lastHomeworkKey){
      state.homeworkNo = hw;
      state.lastHomeworkKey = hw;
      console.log("HOMEWORK_SET", hw);
    }
  }

  if(text.includes("提出")){
    const before = new Set(state.submitted);

    if(!state.isCollecting){
      state.isCollecting = true;
      state.submitted.clear();
    }

    const part = extractAfterSubmit(text);
    const nums = parseNumbers(part);
    nums.forEach((n) => state.submitted.add(n));

    if(!submittedEqual(before, state.submitted)){
      console.log("SUBMIT_UPDATE", [...state.submitted].sort((a, b) => a - b));
    }

    render(state);
    return;
  }

  if(state.isCollecting){
    const before = new Set(state.submitted);
    const nums = parseNumbers(text);
    nums.forEach((n) => state.submitted.add(n));

    if(!submittedEqual(before, state.submitted)){
      console.log("SUBMIT_UPDATE", [...state.submitted].sort((a, b) => a - b));
    }
  }

  render(state);
}

textarea.focus();
render(state);
