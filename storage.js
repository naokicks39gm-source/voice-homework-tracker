function loadAll(){
  const parsed = JSON.parse(localStorage.getItem("data") || "[]");
  if(!Array.isArray(parsed)){
    return [];
  }

  return parsed.map(normalizeRecord).filter(Boolean);
}

function saveAll(data){
  localStorage.setItem("data", JSON.stringify(data));
}

function makeKey(grade, classId, homeworkNo){
  return `${grade}-${classId}-${homeworkNo}`;
}

function now(){
  return Date.now();
}

function normalizeRecord(record){
  if(!record || !Array.isArray(record.submitted)){
    return null;
  }

  const key = record.key || makeKey(record.grade, record.classId, record.homeworkNo);
  const [gradePart, classPart, homeworkPart] = String(key).split("-");
  const grade = record.grade ?? Number(gradePart);
  const classId = record.classId ?? Number(classPart);
  const homeworkNo = record.homeworkNo ?? Number(homeworkPart);
  const createdAt = record.createdAt ?? record.timestamp ?? record.updatedAt ?? 0;
  const updatedAt = record.updatedAt ?? record.timestamp ?? createdAt;

  return {
    key,
    grade,
    classId,
    homeworkNo,
    submitted: [...new Set(record.submitted)].sort((a, b) => a - b),
    createdAt,
    updatedAt
  };
}

function saveData(state){
  const data = loadAll();
  const key = makeKey(state.grade, state.classId, state.homeworkNo);
  const nums = [...state.submitted].sort((a, b) => a - b);
  const idx = data.findIndex((item) => item.key === key);

  if(idx === -1){
    const timestamp = now();
    data.unshift({
      key,
      grade: state.grade,
      classId: state.classId,
      homeworkNo: state.homeworkNo,
      submitted: nums,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }else{
    const set = new Set(data[idx].submitted);
    nums.forEach((n) => set.add(n));

    data[idx].submitted = [...set].sort((a, b) => a - b);
    data[idx].updatedAt = now();

    const item = data.splice(idx, 1)[0];
    data.unshift(item);
  }

  saveAll(data);
}
