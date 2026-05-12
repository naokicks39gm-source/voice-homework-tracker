import { getKey } from "./storage.js";

export function resolveKey(cmd, state) {
  if (!cmd) return null; // ← これ追加

  const grade = cmd.grade ?? state?.grade;
  const classId = cmd.classNum ?? state?.classId;
  const hw = cmd.hw ?? state?.homeworkNo;

  if (grade == null || classId == null || hw == null) {
    return null;
  }

  return getKey({ grade, classNum: classId, hw });
}

export function getDebugKey(cmd, key) {
  if (cmd.type === "studentSummary" && cmd.grade && cmd.classNum) {
    return `${cmd.grade}-${cmd.classNum}`;
  }

  return key;
}
