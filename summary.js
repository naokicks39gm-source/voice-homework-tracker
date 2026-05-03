function getEntryNumbers(entry) {
  if (Array.isArray(entry.nums)) {
    return entry.nums;
  }

  return Object.keys(entry.data || {})
    .filter((n) => entry.data[n])
    .map(Number);
}

function parseKey(key) {
  const match = String(key).match(/^(\d+)-(\d+)-宿題(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    grade: Number(match[1]),
    classNum: Number(match[2]),
    hw: Number(match[3])
  };
}

export function buildSummary(history, grade, classNum, size) {
  const result = {};
  const prefix = `${grade}-${classNum}-宿題`;

  history.forEach((entry) => {
    if (!entry?.key?.startsWith(prefix)) {
      return;
    }

    const hw = Number(entry.key.split("宿題")[1]);
    if (!Number.isFinite(hw)) {
      return;
    }

    if (!result[hw]) {
      result[hw] = new Set();
    }

    getEntryNumbers(entry).forEach((n) => {
      if (Number.isFinite(n)) {
        result[hw].add(n);
      }
    });
  });

  const sortedHw = Object.keys(result)
    .map(Number)
    .sort((a, b) => a - b);

  return sortedHw.map((hw) => {
    const submitted = Array.from(result[hw]).sort((a, b) => a - b);
    const all = Array.from({ length: size }, (_, i) => i + 1);
    const missing = all.filter((n) => !result[hw].has(n));

    return {
      hw,
      submitted,
      missing
    };
  });
}

export function buildCsvRows(history, size) {
  const grouped = {};

  history.forEach((entry) => {
    const parsed = parseKey(entry?.key);
    if (!parsed) {
      return;
    }

    const rowKey = `${parsed.grade}-${parsed.classNum}-${parsed.hw}`;
    if (!grouped[rowKey]) {
      grouped[rowKey] = {
        ...parsed,
        submittedSet: new Set()
      };
    }

    getEntryNumbers(entry).forEach((n) => {
      if (Number.isFinite(n) && n >= 1 && n <= size) {
        grouped[rowKey].submittedSet.add(n);
      }
    });
  });

  return Object.values(grouped)
    .sort((a, b) => a.grade - b.grade || a.classNum - b.classNum || a.hw - b.hw)
    .map((row) => {
      const submitted = Array.from(row.submittedSet).sort((a, b) => a - b);
      const all = Array.from({ length: size }, (_, i) => i + 1);
      const missing = all.filter((n) => !row.submittedSet.has(n));
      const submittedCount = submitted.length;
      const missingCount = missing.length;
      const rate = size === 0
        ? 0
        : Math.round((submittedCount / size) * 100);

      return {
        grade: row.grade,
        classNum: row.classNum,
        hw: row.hw,
        submittedCount,
        missingCount,
        rate,
        submitted,
        missing
      };
    });
}

export function buildStudentSummary(history, grade, classNum, size) {
  const map = {};
  const allHwSet = new Set();
  const prefix = `${grade}-${classNum}-宿題`;

  history.forEach((entry) => {
    if (!entry?.key?.startsWith(prefix)) {
      return;
    }

    const hw = Number(entry.key.split("宿題")[1]);
    if (!Number.isFinite(hw)) {
      return;
    }

    allHwSet.add(hw);

    getEntryNumbers(entry).forEach((n) => {
      if (n >= 1 && n <= size) {
        if (!map[n]) {
          map[n] = new Set();
        }
        map[n].add(hw);
      }
    });
  });

  const allHw = Array.from(allHwSet).sort((a, b) => a - b);
  const totalHw = allHw.length;

  return Array.from({ length: size }, (_, i) => {
    const student = i + 1;
    const submitted = map[student]
      ? Array.from(map[student]).sort((a, b) => a - b)
      : [];
    const missing = allHw.filter((hw) => !submitted.includes(hw));
    const rate = totalHw === 0
      ? 0
      : Math.round((submitted.length / totalHw) * 100);

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
