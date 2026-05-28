import { normalizeClass, normalizeText } from "./normalizer.js";

export function parseClass(text) {
  let m = text.match(/(\d+)年\s*([A-ZＡ-Ｚ])組/i) || text.match(/(\d+)[-ー]([A-ZＡ-Ｚ])/i) || text.match(/(\d+)の(\d+)/) || text.match(/(\d+)[-ー](\d+)/) || text.match(/(\d+)年(\d+)組/);
  if (m) {
    const grade = +m[1];
    const classId = m[2].match(/[A-ZＡ-Ｚ]/i) ? normalizeClass(m[2]) : +m[2];
    return { grade, classId };
  }
  return null;
}

export function parseHomework(text) {
  const cleanText = text.replace(/\d+年/g, "").replace(/\d+組/g, "").replace(/[、。,\s]/g, "");
  // 数字も項目名の一部として含める（元の仕様に戻す）
  const m = cleanText.match(/([^\d]+)(\d+)/);
  return m ? `${m[1]}${m[2]}` : null;
}

export function parseNumbers(text) {
  const result = [];
  const regex = /(\d+)\s*(番|ばん)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    result.push(Number(m[1]));
  }
  return result;
}

export function parseSize(text) {
  const m = text.match(/(\d+)\s*(人|名)/);
  return m ? Number(m[1]) : null;
}

export function parseCommand(text) {
  const t = normalizeText(text);

  if (/生徒別|番号別/.test(t)) {
    const gradeMatch = t.match(/(\d+)年/);
    const classMatch = t.match(/(\d+)組/);
    const sizeMatch = t.match(/(\d+)\s*(人|名)/);
    const grade = gradeMatch ? Number(gradeMatch[1]) : null;
    const classNum = classMatch ? Number(classMatch[1]) : null;
    const size = sizeMatch ? Number(sizeMatch[1]) : null;
    if (!grade || !classNum || !size) return { type: "noop", text: t, grade: null, classNum: null, hw: null, nums: [], size: null };
    return { type: "studentSummary", text: t, grade, classNum, hw: null, nums: [], size };
  }

  const cls = parseClass(t);
  const hw = parseHomework(t);
  const nums = parseNumbers(t);
  const size = parseSize(t);

  let type = "input";
  if (/(削除|消す|delete)/i.test(t)) type = "delete";
  else if (/追加/.test(t)) type = "add";
  else if (/提出/.test(t)) type = "submit";

  return { type, text: t, grade: cls?.grade ?? null, classNum: cls?.classId ?? null, hw, nums, size };
}
