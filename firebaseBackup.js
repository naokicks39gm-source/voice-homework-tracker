import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  addDoc, // これが不足している可能性があります
  collection,
  doc,
  getDoc, // これも保存ロジックで使うため追加
  getFirestore,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDmiSD84qxoFVqDsaFGl0mXSj4FQVJQ2-c",
  authDomain: "voice-homework-checker.firebaseapp.com",
  projectId: "voice-homework-checker",
  storageBucket: "voice-homework-checker.firebasestorage.app",
  messagingSenderId: "641056865813",
  appId: "1:641056865813:web:3a413ca71c5fe75009581c",
  measurementId: "G-P53NH2QYY8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

onAuthStateChanged(auth, (user) => {
  currentUser = user;
});

export function getCurrentUser() {
  return currentUser || auth.currentUser;
}

export async function signInAdmin() {
  const result = await signInWithPopup(auth, provider);
  currentUser = result.user;
  return currentUser;
}

export async function logoutAdmin() {
  await signOut(auth);
  currentUser = null;
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, (user) => {
    currentUser = user;
    callback(user);
  });
}

export async function backupLocalDataToFirestore(data) {
  const user = getCurrentUser();
  if (!user) throw new Error("Firebase login required");

  return addDoc(collection(db, "backups"), data);
}

/**
 * ★ここが本体
 */
export async function publishStudentSummaryToFirestore(rows, context) {
  const user = getCurrentUser();
  if (!user) throw new Error("Firebase login required");

  const grade = Number(context?.grade);
  const classNum = Number(context?.classNum);
  const hwCategory = context?.hw || "宿題"; // URLのhwパラメータがここに入る想定

  const year = new Date().getFullYear().toString();
  const docId = `${year}_${grade}_${classNum}`;
  const docRef = doc(db, "studentShares", docId);

  // 1. 既存データの取得（他の教科を残すため）
  let existingStudents = {};
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      existingStudents = snap.data().students || {};
    }
  } catch (e) { console.warn("既存データなし、新規作成します"); }

  // 2. 指定した教科（hwCategory）のみ更新
  existingStudents[hwCategory] = {};
  rows.forEach((row) => {
    const student = Number(row.student);
    if (!Number.isFinite(student)) return;
    existingStudents[hwCategory][student] = {
      rate: Number(row.rate) || 0,
      submitted: Array.isArray(row.submitted) ? row.submitted.map(Number).filter(Number.isFinite) : [],
      missing: Array.isArray(row.missing) ? row.missing.map(Number).filter(Number.isFinite) : [],
      submittedCount: Number(row.submittedCount) || 0,
      totalHw: Number(row.totalHw) || 0
    };
  });

  const payload = {
    year,
    grade,
    classNum,
    students: existingStudents,
    updatedAt: serverTimestamp()
  };

  await setDoc(docRef, payload);
  return true;
}