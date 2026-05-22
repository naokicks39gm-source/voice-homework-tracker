import { getNumbers } from "./storage.js";
import { getKey } from "./storage.js";

/**
 * stateはUI入力専用
 * submitted系はstorageからのみ取得
 */

// =========================
// renderState
// =========================
export function renderState(state) {
  const el = document.getElementById("state");
  if (!el) return;

  const key = getKey(state);
  const submitted = getNumbers(key);

  el.innerHTML = `
    <div>grade: ${state.grade ?? "-"}</div>
    <div>class: ${state.classNum ?? "-"}</div>
    <div>homeworkNo: ${state.hw ?? "-"}</div>
    <div>submitted: ${submitted.length ? submitted.join(", ") : "-"}</div>
  `;
}


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
// renderStudentSummaryTable
// =========================
export function renderStudentSummaryTable(rows) {
  const container = document.getElementById("summary");
  if (!container) return;

  container.innerHTML = "";

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
    const submitted = getNumbers(row.key);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.student}</td>
      <td class="submitted">${submitted.length ? submitted.join(", ") : "-"}</td>
      <td class="missing">${row.missing?.length ? row.missing.join(", ") : "-"}</td>
      <td>${submitted.length}/${row.totalHw}（${row.rate}%）</td>
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