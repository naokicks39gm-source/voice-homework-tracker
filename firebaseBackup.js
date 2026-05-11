import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { addDoc, collection, doc, getFirestore, serverTimestamp, setDoc }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
let currentUser = auth.currentUser;

onAuthStateChanged(auth, (user) => {

  currentUser = user;
});

export async function signInAdmin() {
  const result = await signInWithPopup(auth, provider);
  currentUser = result.user;
  return currentUser;
}

export function getCurrentUser() {
  return currentUser || auth.currentUser;
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
  if (!getCurrentUser()) {
    throw new Error("Firebase login required");
  }

  return addDoc(collection(db, "backups"), data);
}

export async function publishStudentSummaryToFirestore(rows, context) {
  
  console.log("context:", context);
  
  if (!getCurrentUser()) {
    throw new Error("Firebase login required");
  }

  const grade = Number(context?.grade);
  const classNum = Number(context?.classNum);

  if (!Number.isFinite(grade) || !Number.isFinite(classNum)) {
    throw new Error("Student summary context required");
  }

  const classId = `${grade}-${classNum}`;

  // 生徒一覧をまとめる
  const students = {};

  rows.forEach((row) => {
    const student = Number(row.student);
    if (!Number.isFinite(student)) return;

    students[student] = {
      rate: Number(row.rate) || 0,
      submitted: Array.isArray(row.submitted) ? row.submitted.map(Number).filter(Number.isFinite) : [],
      missing: Array.isArray(row.missing) ? row.missing.map(Number).filter(Number.isFinite) : [],
      submittedCount: Number(row.submittedCount) || 0,
      totalHw: Number(row.totalHw) || 0
    };
  });

  try {
    await setDoc(doc(db, "studentShares", classId), {
      grade,
      classNum,
      students,
      updatedAt: serverTimestamp()
    }, { merge: true });

    console.log("SUCCESS");
    return true;

  } catch (e) {
    console.error("PUBLISH_ERROR", e.code, e.message);
    throw e;
  }
}
