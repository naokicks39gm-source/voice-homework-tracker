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

// 2. 🔥【修正の核心】キーの末尾に何があっても絶対に部分一致で数字をぶち抜く安全な正規表現
function parseKey(key) {
  // 末尾の $ を除去し、文字列の途中に「1-1-宿題7」があれば確実に捕まえるように修正
  const match = String(key || "").match(/(\d+)-(\d+)-宿題(\d+)/);
  if (!match) return null;
  return {
    grade: Number(match[1]),
    classNum: Number(match[2]),
    hw: Number(match[3])
  };
}

// 3. 生徒別サマリー集計
export function buildStudentSummary(history, grade, classNum, providedSize) {  const map = {};
  const allHwSet = new Set();
  const prefix = `${grade}-${classNum}-宿題`;
  const evalLimit = 120;
  const displayLimit = Number(size) || 40;
  const finalHistory = Array.isArray(history) ? history : [];

// 1. 履歴からこのクラスの「最大番号」を探す（これが自動的な生徒数になる）
  const classHistory = history.filter(item => item.key.startsWith(`${grade}-${classNum}-`));
  const maxNum = Math.max(...classHistory.flatMap(item => item.nums), 0);
  
 // 2. 引数で渡されたprovidedSizeがなければ、maxNumまたは30を使用
  const size = providedSize || maxNum || 30; // 👈 ここをconstで宣言する
  
  finalHistory.forEach((entry) => {
    if (!entry || !entry.key || !entry.key.startsWith(prefix)) return;

    const parsed = parseKey(entry.key);
    if (!parsed) return; // 安全対策

    const hw = parsed.hw;
    allHwSet.add(hw);

    const studentNums = getEntryNumbers(entry);
    studentNums.forEach((n) => {
      if (n >= 1 && n <= evalLimit) {
        if (!map[n]) {
          map[n] = new Set();
        }
        map[n].add(hw);
      }
    });
  });

  const allHw = Array.from(allHwSet).sort((a, b) => a - b);
  const totalHw = allHw.length;

  return Array.from({ length: displayLimit }, (_, i) => {
    const student = i + 1;
    const submitted = map[student]
      ? Array.from(map[student]).sort((a, b) => a - b)
      : [];
    const missing = allHw.filter((hw) => !submitted.includes(hw));
    const rate = totalHw === 0 ? 0 : Math.round((submitted.length / totalHw) * 100);

    return {
      student,
      submitted,
      missing,
      submittedCount: submitted.length,
      totalHw,
      rate
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