import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  addDoc,
  collection,
  doc,
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

  console.log("UID:", user.uid);
  console.log("CONTEXT:", context);

  const grade = Number(context?.grade);
  const classNum = Number(context?.classNum);

  if (!Number.isFinite(grade) || !Number.isFinite(classNum)) {
    throw new Error("Invalid context");
  }

  const year = new Date().getFullYear().toString();

  // ★統一キー（これが読み書き共通ルール）
  const docId = `${year}_${grade}_${classNum}`;

  const students = {};

  rows.forEach((row) => {
    const student = Number(row.student);
    if (!Number.isFinite(student)) return;

    students[student] = {
      rate: Number(row.rate) || 0,
      submitted: Array.isArray(row.submitted)
        ? row.submitted.map(Number).filter(Number.isFinite)
        : [],
      missing: Array.isArray(row.missing)
        ? row.missing.map(Number).filter(Number.isFinite)
        : [],
      submittedCount: Number(row.submittedCount) || 0,
      totalHw: Number(row.totalHw) || 0
    };
  });

  const payload = {
    year,
    grade,
    classNum,
    students,
    updatedAt: serverTimestamp()
  };

  console.log("WRITE_DOC:", docId, payload);

  try {
    await setDoc(doc(db, "studentShares", docId), payload);
    console.log("SUCCESS");
    return true;
  } catch (e) {
    console.error("PUBLISH_ERROR:", e.code, e.message);
    throw e;
  }
}