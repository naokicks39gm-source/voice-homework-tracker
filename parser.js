function parseClass(text){
  let m;

  m = text.match(/(\d+)年\s*([A-ZＡ-Ｚ])組/i);
  if(m){
    return {
      grade: +m[1],
      classId: normalizeClass(m[2])
    };
  }

  m = text.match(/(\d+)[-ー]([A-ZＡ-Ｚ])/i);
  if(m){
    return {
      grade: +m[1],
      classId: normalizeClass(m[2])
    };
  }

  m = text.match(/(\d+)の(\d+)/);
  if(m) return {grade:+m[1], classId:+m[2]};

  m = text.match(/(\d+)[-ー](\d+)/);
  if(m) return {grade:+m[1], classId:+m[2]};

  m = text.match(/(\d+)年(\d+)組/);
  if(m) return {grade:+m[1], classId:+m[2]};

  return null;
}

function parseHomework(text){
  const m = text.match(/宿題\s*(\d+)/);
  return m ? +m[1] : null;
}

function parseNumbers(text){
  const matches = text.match(/(\d+)\s*(番|ばん)/g);
  if(!matches) return [];
  return matches.map((m) => Number(m.match(/\d+/)[0]));
}

function parseAddCommand(text){
  const cls = parseClass(text);
  const hw = parseHomework(text);
  if(!cls || !hw){
    return null;
  }

  if(!/追加/.test(text)){
    return null;
  }

  const nums = parseNumbers(text);
  if(nums.length === 0){
    return null;
  }

  return {
    grade: cls.grade,
    classId: cls.classId,
    homeworkNo: hw,
    nums
  };
}
