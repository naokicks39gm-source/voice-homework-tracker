// 1. あらゆるデータ構造から出席番号を確実に抽出する安全な関数
function getEntryNumbers(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.nums)) {
    return entry.nums.map(Number).filter(n => Number.isFinite(n) && !isNaN(n));
  }
  if (entry.data && typeof entry.data === "object") {
    return Object.keys(entry.data)
      .filter((n) => entry.data[n] === true || entry.data[n] === "true")
      .map(Number)
      .filter(n => Number.isFinite(n) && !isNaN(n));
  }
  return [];
}

// 💡 カテゴリ名と数字を正しく分離するパーサー
function parseKey(key) {
  // 正規表現: 1-1-数学3 のような形式を分解
  // (\d+)-(\d+)-([^\d]+)(\d+)
  // 1:学年, 2:組, 3:カテゴリ名(数学), 4:番号(3)
  const match = String(key || "").match(/^(\d+)-(\d+)-([^\d]+)(\d+)$/);
  if (!match) return null;
  return {
    grade: Number(match[1]),
    classNum: Number(match[2]),
    category: match[3], // "数学" や "理科"
    hw: `${match[3]}${match[4]}` // "数学3" (これまでの集計用)
  };
}

export function buildStudentSummary(history, grade, classNum, providedSize, targetHw) {
  if (!Array.isArray(history)) return [];

  // 1. 指定されたカテゴリ(targetHw)またはクラス全体でフィルタリング
  // targetHwが"数学"なら、1-1-数学 で始まる全ての履歴を対象にする
  const filteredHistory = targetHw 
    ? history.filter(item => item.key.startsWith(`${grade}-${classNum}-${targetHw}`))
    : history.filter(item => item.key.startsWith(`${grade}-${classNum}-`));

  // 2. サイズ決定
  const classHistory = history.filter(item => item.key.startsWith(`${grade}-${classNum}-`));
  const maxNum = Math.max(...classHistory.flatMap(item => item.nums), 0);
  const size = providedSize || maxNum || 30; 

 // 3. 必要な変数の準備
  const map = {};
  const allHwSet = new Set();
  const evalLimit = 120;

  // 💡 【修正】そのカテゴリ（targetHw）に存在する「個別の課題名（数学1, 数学3など）」を全網羅する
  history.forEach((entry) => {
    const parsed = parseKey(entry.key);
    // targetHw（例: 数学）に属する履歴なら、その個別の課題名（数学1など）をセットに追加
    if (parsed && parsed.category === targetHw) {
      allHwSet.add(parsed.hw); 
    }
  });

  // 個別の提出状況をマッピング
  filteredHistory.forEach((entry) => {
    const parsed = parseKey(entry.key);
    if (!parsed) return;

    const studentNums = getEntryNumbers(entry);
    studentNums.forEach((n) => {
      if (n >= 1 && n <= evalLimit) {
        if (!map[n]) map[n] = new Set();
        map[n].add(parsed.hw); // ここも数学1, 数学3が入る
      }
    });
  });

  const allHw = Array.from(allHwSet).sort();
  const totalHw = allHw.length;

  return Array.from({ length: size }, (_, i) => {
    const student = i + 1;
    // 提出した全項目リスト
    const submitted = map[student] ? Array.from(map[student]) : [];
    // カテゴリ全体での未提出確認（カテゴリが合致するものだけを抽出）
    const missing = allHw.filter((cat) => !submitted.some(s => s.startsWith(cat)));
    
    return {
      student,
      submitted,
      missing,
      submittedCount: submitted.length,
      totalHw,
      rate: totalHw === 0 ? 0 : Math.round((submitted.length / totalHw) * 100)
    };
  });
}
// 4. クラス全体サマリー集計
export function buildSummary(history, grade, classNum, size) {
  const result = {};
  const prefix = `${grade}-${classNum}-宿題`;
  const maxStudents = Number(size) || 40;
  const finalHistory = Array.isArray(history) ? history : [];

  finalHistory.forEach((entry) => {
    if (!entry || !entry.key || !entry.key.startsWith(prefix)) return;

    const parsed = parseKey(entry.key);
    if (!parsed) return;

    const hw = parsed.hw;
    if (!result[hw]) {
      result[hw] = new Set();
    }

    getEntryNumbers(entry).forEach((n) => {
      if (Number.isFinite(n)) {
        result[hw].add(n);
      }
    });
  });

  const sortedHw = Object.keys(result).map(Number).sort((a, b) => a - b);
  return sortedHw.map((hw) => {
    const submitted = Array.from(result[hw]).sort((a, b) => a - b);
    const all = Array.from({ length: maxStudents }, (_, i) => i + 1);
    const missing = all.filter((n) => !result[hw].has(n));
    return { hw, submitted, missing };
  });
}

// 5. CSV出力用データ集計
export function buildCsvRows(history, size) {
  const grouped = {};
  const maxStudents = Number(size) || 40;
  const finalHistory = Array.isArray(history) ? history : [];

  finalHistory.forEach((entry) => {
    if (!entry) return;
    const parsed = parseKey(entry.key);
    if (!parsed) return;

    const rowKey = `${parsed.grade}-${parsed.classNum}-${parsed.hw}`;
    if (!grouped[rowKey]) {
      grouped[rowKey] = { ...parsed, submittedSet: new Set() };
    }

    getEntryNumbers(entry).forEach((n) => {
      if (Number.isFinite(n) && n >= 1 && n <= maxStudents) {
        grouped[rowKey].submittedSet.add(n);
      }
    });
  });

  return Object.values(grouped)
    .sort((a, b) => a.grade - b.grade || a.classNum - b.classNum || a.hw - b.hw)
    .map((row) => {
      const submitted = Array.from(row.submittedSet).sort((a, b) => a - b);
      const all = Array.from({ length: maxStudents }, (_, i) => i + 1);
      const missing = all.filter((n) => !row.submittedSet.has(n));
      return {
        grade: row.grade,
        classNum: row.classNum,
        hw: row.hw,
        submittedCount: submitted.length,
        missingCount: missing.length,
        rate: maxStudents === 0 ? 0 : Math.round((submitted.length / maxStudents) * 100),
        submitted,
        missing
      };
    });
}