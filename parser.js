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

export function parseCommand(text) {
  const t = normalizeText(text);
  const cls = parseClass(t);
  const hw = parseHomework(t);
  const nums = parseNumbers(t);

  let type = "input";
  if (/(削除|消す|delete)/i.test(t)) {
    type = "delete";
  } else if (/追加/.test(t)) {
    type = "add";
  } else if (/提出/.test(t)) {
    type = "submit";
  }

  return {
    type,
    text: t,
    grade: cls?.grade ?? null,
    classNum: cls?.classId ?? null,
    hw: hw ?? null,
    nums
  };
}
