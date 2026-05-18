// save.js

import { getState } from "../state.js";
// ✅ こう変える
import { commit, getNumbers } from "../../storage.js";
import { publishStudentSummaryToFirestore } from "../../firebaseBackup.js";

export async function handleSave(key, cmd) {
  if (!key) return;

  // ① 履歴を確定（ローカル）
  commit(key);

  // ② 状態取得
  const state = getState();

  // ③ Firestore用データ作成
  const context = {
    grade: state.grade,
    classNum: state.classId
  };

  const rows = [
    {
      student: cmd?.nums?.[0] || 1,
      rate: 0,
      submitted: getNumbers(key) || [],
      missing: [],
      submittedCount: cmd?.nums?.length || 0,
      totalHw: 1
    }
  ];

  // ④ Firestore保存
  try {
    await publishStudentSummaryToFirestore(rows, context);
  } catch (e) {
    console.error("FIRESTORE_SAVE_ERROR:", e);
  }
}