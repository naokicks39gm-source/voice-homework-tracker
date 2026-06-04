const STORAGE_KEY = "homeworkMap";
const HISTORY_KEY = "homeworkHistory";
const LEGACY_KEY = "data";

let homeworkMap = {};
let pendingMap = {};

function normalizeNums(nums) {
  return [...new Set((nums || []).map(Number).filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

function legacyKeyToCommand(key) {
  const match = String(key).match(/^(\d+)-(\d+)-(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    grade: Number(match[1]),
    classNum: Number(match[2]),
    hw: Number(match[3])
  };
}

// storage.js の getKey を以下に修正してください
export function getKey({ grade, classNum, hw }) {
  // 💡 末尾の数字を削除せず、そのまま教科名として使う
  // これにより「英語11」と「英語12」が別のキーとして管理されます
  const cleanHw = String(hw || "").trim();
  
  return `${grade}-${classNum}-${cleanHw}`;
}

function migrateLegacyData() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    return {};
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!Array.isArray(parsed)) {
    return {};
  }

  const next = {};
  parsed.forEach((item) => {
    

    const fallback = legacyKeyToCommand(item.key);
    const grade = item.grade ?? fallback?.grade;
    const classNum = item.classId ?? fallback?.classNum;
    const hw = item.homeworkNo ?? fallback?.hw;

    if (!grade || !classNum || !hw) {
      return;
    }

    const key = getKey({ grade, classNum, hw });
    next[key] = {};
    
  });

  return next;
}

export function loadFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        homeworkMap = {};
        Object.entries(parsed).forEach(([key, value]) => {
          homeworkMap[key] = {};
          Object.keys(value || {}).forEach((n) => {
            if (value[n]) {
              homeworkMap[key][Number(n)] = true;
            }
          });
        });
        pendingMap = JSON.parse(JSON.stringify(homeworkMap));
        return homeworkMap;
      }
    } catch {
      homeworkMap = {};
    }
  }

  homeworkMap = migrateLegacyData();
  pendingMap = JSON.parse(JSON.stringify(homeworkMap));
  saveToLocalStorage();
  return homeworkMap;
}

export function saveToLocalStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(homeworkMap));
}

function saveHistory(entry) {
  // 1. 全履歴を取得
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

  // 2. 同じ key を持つ古い履歴をすべて除去する
  // これにより、同じ宿題の「古い提出状況（削除前のデータなど）」が残ることを防ぎます
  history = history.filter((h) => h.key !== entry.key);

  // 3. 最新のデータのみを末尾に追加して保存
  history.push(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function add(key, nums) {
  console.log("add", key, nums); 
  
  // 💡 もし pendingMap が空なら、確定済みのデータ(homeworkMap)から引き継ぐ
  if (!pendingMap[key]) {
    pendingMap[key] = homeworkMap[key] ? JSON.parse(JSON.stringify(homeworkMap[key])) : {};
  }

  normalizeNums(nums).forEach((n) => {
    pendingMap[key][n] = true;
  });
}

export function remove(key, nums) {
  if (!pendingMap[key]) {
    return;
  }

  normalizeNums(nums).forEach((n) => {
    delete pendingMap[key][n];
  });
}

export function submit(key, nums) {
  if (!pendingMap[key]) {
    pendingMap[key] = {};
  }

  normalizeNums(nums).forEach((n) => {
    pendingMap[key][n] = true;
  });
}

export function commit(key) {
  console.log("commit", key);

  // 1. 真の提出番号のみを配列として抽出
  const currentPending = pendingMap[key] || {};
  const nums = Object.keys(currentPending)
    .filter(k => currentPending[k] === true)
    .map(Number)
    .sort((a, b) => a - b); // 念のためソート

  // 2. 確定状態のマップを更新
  homeworkMap[key] = currentPending;

  // 3. ローカルストレージを保存
  saveToLocalStorage();

  // 4. 【重要】履歴を保存する際、古いものを完全に除去した「現在の nums」だけをセットする
  saveHistory({
    key,
    nums: nums, // ここでフィルタリング・ソート済みのクリーンな配列を渡す
    timestamp: Date.now()
  });

// 💡 【ここが重要！】保存が終わったら pendingMap を完全に空にする
  // これにより、次の教科の入力に前の教科の番号が混ざらなくなります。
  clearPending(); 
  console.log("pendingMap has been cleared for next input");
}

export function get(key) {
  return homeworkMap[key] || {};
}

export function getNumbers(key) {
  return Object.keys(get(key)).map(Number).sort((a, b) => a - b);
}

export function clearPending() {
  pendingMap = {};
}

export function clearAllData() {
  homeworkMap = {};
  pendingMap = {};
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(LEGACY_KEY);
}
// storage.js に追記
export function set(key, nums) {
  // 💡 既存のデータを無視して、新しい nums だけをセットする
  pendingMap[key] = {}; 
  normalizeNums(nums).forEach((n) => {
    pendingMap[key][n] = true;
  });
}