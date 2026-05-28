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
    title.textContent = `${context.grade}年${context.classNum}組 提出状況`;
    container.appendChild(title);
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <tr>
      <th>番号</th>
      <th>提出済み宿題</th>
      <th>未提出宿題</th>
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
  
  // 「学年-組-項目」の組み合わせを重複なしで作成
  const uniqueKeys = [...new Set(history.map(item => item.key))];

// ui.js 内の renderClassButtons の中身を以下に差し替えてください
  uniqueKeys.forEach(key => {
    const [grade, classNum, hw] = key.split("-");
    
    // 💡 ボタン名を作る時だけ、末尾の数字を除去する（数学1 → 数学）
    const displayLabel = hw.replace(/\d+$/, ""); 
    
    // このIDで重複を防ぐ（例: btn-1-1-数学）
    const btnId = `btn-${grade}-${classNum}-${displayLabel}`;
    if (document.getElementById(btnId)) return; 

    const btn = document.createElement("button");
    btn.id = btnId;
    // 表示は「数学」だが、クリック時には元の「数学1」という hw を渡す
    btn.textContent = `${grade}年${classNum}組 ${displayLabel}`;
    
    btn.onclick = () => {
        // 💡 重要な修正: 検索のヒントとして「displayLabel (数学)」を渡す
        // これにより summary.js が startsWith("数学") で数学1も数学3も拾える
        onClassClick(Number(grade), Number(classNum), displayLabel);
    };
    container.appendChild(btn);
  });
}