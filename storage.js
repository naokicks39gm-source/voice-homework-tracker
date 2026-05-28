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

// storage.js の getKey 関数
export function getKey({ grade, classNum, hw }) {
  // 「宿題」という文字列を削除し、純粋に引数からキーを生成する
  return `${grade}-${classNum}-${hw}`;
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
  const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");

  const exists = history.some(
    (h) =>
      h.key === entry.key &&
      JSON.stringify(h.nums) === JSON.stringify(entry.nums)
  );

  if (!exists) {
    history.push(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
}

export function add(key, nums) {
   console.log("add", key, nums); 
  if (!pendingMap[key]) {
    pendingMap[key] = {};
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
  homeworkMap[key] = { ...(pendingMap[key] || {}) };
  saveToLocalStorage();
  pendingMap[key] = { ...(homeworkMap[key] || {}) };
saveHistory({
  key,
  nums: normalizeNums(Object.keys(homeworkMap[key] || {})),
  timestamp: Date.now()
});
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
