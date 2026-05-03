import { normalizeClass, normalizeText } from "./normalizer.js";

export function parseClass(text) {
  let m;

  m = text.match(/(\d+)年\s*([A-ZＡ-Ｚ])組/i);
  if (m) {
    return {
      grade: +m[1],
      classId: normalizeClass(m[2])
    };
  }

  m = text.match(/(\d+)[-ー]([A-ZＡ-Ｚ])/i);
  if (m) {
    return {
      grade: +m[1],
      classId: normalizeClass(m[2])
    };
  }

  m = text.match(/(\d+)の(\d+)/);
  if (m) {
    return { grade: +m[1], classId: +m[2] };
  }

  m = text.match(/(\d+)[-ー](\d+)/);
  if (m) {
    return { grade: +m[1], classId: +m[2] };
  }

  m = text.match(/(\d+)年(\d+)組/);
  if (m) {
    return { grade: +m[1], classId: +m[2] };
  }

  return null;
}

export function parseHomework(text) {
  const m = text.match(/宿題\s*(\d+)/);
  return m ? +m[1] : null;
}

export function parseNumbers(text) {
  const matches = text.match(/(\d+)\s*(番|ばん)/g);
  if (!matches) {
    return [];
  }
  return matches.map((m) => Number(m.match(/\d+/)[0]));
}

export function parseSize(text) {
  const m = text.match(/(\d+)\s*(人|名)/);
  return m ? Number(m[1]) : null;
}

export function parseCommand(text) {
  const t = normalizeText(text);
  const cleanText = /保存$/.test(t.trim()) ? t.replace(/保存.*/, "保存") : t;

  if (/生徒別|番号別/.test(t)) {
    const gradeMatch = t.match(/(\d+)年/);
    const classMatch = t.match(/(\d+)組/);
    const sizeMatch = t.match(/(\d+)\s*(人|名)/);

    const grade = gradeMatch ? Number(gradeMatch[1]) : null;
    const classNum = classMatch ? Number(classMatch[1]) : null;
    const size = sizeMatch ? Number(sizeMatch[1]) : null;

    if (!grade || !classNum || !size) {
      console.log("DEBUG_SKIP_INVALID_STUDENT_SUMMARY");
      return {
        type: "noop",
        text: t,
        grade: null,
        classNum: null,
        hw: null,
        nums: [],
        size: null
      };
    }

    return {
      type: "studentSummary",
      text: t,
      grade,
      classNum,
      hw: null,
      nums: [],
      size
    };
  }

  const cls = parseClass(t);
  const hw = parseHomework(t);
  const nums = parseNumbers(t);
  const size = parseSize(t);

  let type = "input";
  if (/(集計|一覧|summary|サマリー)/i.test(t)) {
    type = "summary";
  } else if (/保存$/.test(t.trim())) {
    type = "save";
  } else if (/(削除|消す|delete)/i.test(t)) {
    type = "delete";
  } else if (/追加/.test(t)) {
    type = "add";
  } else if (/提出/.test(t)) {
    type = "submit";
  }

  return {
    type,
    text: cleanText,
    grade: cls?.grade ?? null,
    classNum: cls?.classId ?? null,
    hw: hw ?? null,
    nums,
    size
  };
}
