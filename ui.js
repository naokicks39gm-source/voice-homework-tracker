import { getNumbers } from "./storage.js";
import { getKey } from "./storage.js";

/**
 * stateはUI入力専用
 * submitted系はstorageからのみ取得
 */



// =========================
// renderList
// =========================
export function renderList(state) {
  return; //
  if (!state || state.grade == null || state.classNum == null) return;

  const keyPrefix = `${state.grade}-${state.classNum}`;
  const history = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");

  const latestMap = {};

  history.forEach(item => {
    if (!item.key.startsWith(keyPrefix)) return;

    if (!latestMap[item.key] || latestMap[item.key].timestamp < item.timestamp) {
      latestMap[item.key] = item;
    }
  });

  const el = document.getElementById("list");
  if (!el) return;

  el.innerHTML = "";

  Object.values(latestMap).forEach(item => {
    const div = document.createElement("div");
    div.textContent = item.key;
    el.appendChild(div);
  });
}


// =========================
// renderHistory
// =========================
export function renderHistory() {
  const el = document.getElementById("history");
  if (!el) return;

  el.innerHTML = "";

  const history = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");

  history.slice().reverse().forEach((item) => {
    const div = document.createElement("div");

    const nums = Array.isArray(item.nums)
      ? item.nums
      : getNumbers(item.key);

   // ✨ 修正後：mapを使って、すべての数字の後ろに「番」をつけてからスペースで繋ぐ
div.textContent = `${item.key} : ${nums.length ? nums.map(n => `${n}番`).join(" ") : "-"}`;
    el.appendChild(div);
  });
}


// =========================
// chunk
// =========================
function chunk(values, size = 10) {
  if (!Array.isArray(values)) return "-";

  const result = [];
  for (let i = 0; i < values.length; i += size) {
    result.push(values.slice(i, i + size).join(", "));
  }
  return result.join("<br>");
}


// =========================
// renderSummaryTable
// =========================
export function renderSummaryTable(rows) {
  const container = document.getElementById("summary");
  if (!container) return;

  container.innerHTML = "";

  const table = document.createElement("table");
  table.innerHTML = "<tr><th>宿題</th><th>提出</th></tr>";

  rows.forEach((row) => {
    const submitted = getNumbers(row.key);
  console.log("row:", row);
  console.log("submitted:", submitted);
  console.log("key:", row.key);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.hw}</td>
      <td class="submitted">${submitted.length ? submitted.join(", ") : "-"}</td>
    `;

    table.appendChild(tr);
  });

  container.appendChild(table);
}


// =========================
// renderStudentSummaryTable（完全に修正された防弾版）
// =========================
export function renderStudentSummaryTable(rows, context = null) {
  const container = document.getElementById("summary");
  if (!container) return;

  container.innerHTML = "";

// 💡 1. タイトルとボタンを囲むヘッダーラッパーを作成
if (context) {
    const title = document.createElement("h2");
    
    // 💡 context.hw があれば「〇〇 」を付与する（数字のみの場合は空文字にする）
    // 数字以外の文字（数学など）だけを抽出してタイトルに繋げます
    const hwPart = context.hw ? context.hw.replace(/\d+$/, "") : "";
    const hwDisplay = hwPart ? `${hwPart} ` : "";
    
    title.textContent = `${context.grade}年${context.classNum}組 ${hwDisplay}提出状況`;
    container.appendChild(title);
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <tr>
      <th>番号</th>
      <th>提出済み</th>
      <th>未提出</th>
      <th>提出率</th>
    </tr>
  `;

  rows.forEach((row) => {
    // 💡 row.key から取得するのではなく、summary.js が集計した row.submitted を直接使用する
    const subList = Array.isArray(row.submitted) ? row.submitted : [];
    const misList = Array.isArray(row.missing) ? row.missing : [];

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.student}番</td>
     <td class="submitted">${subList.length ? subList.join(", ") : "-"}</td>
      <td class="missing">${misList.length ? misList.join(", ") : "-"}</td>
      <td>${subList.length}/${row.totalHw}（${row.rate}%）</td>
    `;

    table.appendChild(tr);
  });

  container.appendChild(table);
}


// =========================
// downloadCsv
// =========================
export function downloadCsv(filename, text) {
  const blob = new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}


// =========================
// downloadHtml
// =========================
export function downloadHtml(filename, htmlText) {
  const blob = new Blob([htmlText], { type: "text/html;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}
// =========================
// ボタン作成
// =========================
// ui.js の renderClassButtons
export function renderClassButtons(onClassClick) {
  const container = document.getElementById("class-buttons");
  if (!container) return;
  container.innerHTML = "";

  const history = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");
  const uniqueKeys = [...new Set(history.map(item => item.key))];

  uniqueKeys.forEach(key => {
    const [grade, classNum, hw] = key.split("-");
    const displayLabel = hw.replace(/\d+$/, "");
    const btnId = `btn-${grade}-${classNum}-${displayLabel}`;
    
    if (document.getElementById(btnId)) return; 

    // コンテナ：インラインブロックにして CSS クラスを付与
    const wrapper = document.createElement("span");
    wrapper.className = "subject-wrapper"; 

    // ① 教科ボタン
    const btn = document.createElement("button");
    btn.id = btnId;
    btn.textContent = `${grade}年${classNum}組 ${displayLabel}`;
    btn.onclick = () => onClassClick(Number(grade), Number(classNum), displayLabel);
    
    // ② 削除ボタン (×)
    const delBtn = document.createElement("button");
    delBtn.textContent = "×";
    delBtn.className = "delete-btn"; // クラスを付与
    
    delBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(`項目「${displayLabel}」を完全に削除しますか？`)) {
        try {
          const { deleteSubjectFromFirestore } = await import("./firebasebackup.js");
          const docId = `2026_${grade}_${classNum}`;
          
          await deleteSubjectFromFirestore(docId, displayLabel);

          const history = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");
          const filteredHistory = history.filter(item => {
             const parts = item.key.split("-");
             return parts[2].replace(/\d+$/, "") !== displayLabel;
          });
          localStorage.setItem("homeworkHistory", JSON.stringify(filteredHistory));
          
          const map = JSON.parse(localStorage.getItem("homeworkMap") || "{}");
          delete map[`${grade}-${classNum}-${displayLabel}`];
          localStorage.setItem("homeworkMap", JSON.stringify(map));

          alert("削除しました。");
          location.reload();
        } catch (err) {
          console.error("削除エラー:", err);
          alert("削除に失敗しました。");
        }
      }
    };

    wrapper.appendChild(btn);
    wrapper.appendChild(delBtn);
    container.appendChild(wrapper);
  });
}