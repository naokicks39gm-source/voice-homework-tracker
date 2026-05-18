import { get } from "./storage.js";

export function renderState(state) {
  const submitted = [...(state.submitted || [])].sort((a, b) => a - b);
  const stateView = document.getElementById("state");

  if (!stateView) return;

  stateView.innerHTML = `
    <div>grade: ${state.grade ?? "-"}</div>
    <div>class: ${state.classNum ?? "-"}</div>
    <div>homeworkNo: ${state.homeworkNo ?? "-"}</div>
    <div>submitted: ${submitted.length ? submitted.join(", ") : "-"}</div>
  `;
}

export function renderList(key) {
  const el = document.getElementById("list");
  if (!el) {
    return;
  }

  el.innerHTML = "";
  if (!key) {
    return;
  }

  const data = get(key);
  Object.keys(data).map(Number).sort((a, b) => a - b).forEach((n) => {
    const div = document.createElement("div");
    div.textContent = `${n}番`;
    el.appendChild(div);
  });
}

export function renderHistory() {
  const el = document.getElementById("history");
  if (!el) {
    return;
  }

  el.innerHTML = "";

  const history = JSON.parse(localStorage.getItem("homeworkHistory") || "[]");

  history.slice().reverse().forEach((item) => {
    const div = document.createElement("div");
    const nums = Object.keys(item.data || {})
      .map(Number)
      .sort((a, b) => a - b)
      .map((n) => `${n}番`)
      .join(", ");

    div.textContent = `${item.key} : ${nums || "-"}`;
    el.appendChild(div);
  });
}

function chunk(values, size = 10) {
  const result = [];
  for (let i = 0; i < values.length; i += size) {
    result.push(values.slice(i, i + size).join(", "));
  }
  return result.join("<br>");
}

export function renderSummaryTable(rows) {
  const container = document.getElementById("summary");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  const table = document.createElement("table");
  table.innerHTML = "<tr><th>宿題</th><th>提出</th></tr>";

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.hw}</td>
      <td class="submitted">${chunk(row.submitted)}</td>
    `;
    table.appendChild(tr);
  });

  container.appendChild(table);
}

export function renderStudentSummaryTable(rows) {
  const container = document.getElementById("summary");
  if (!container) {
    return;
  }

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
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.student}</td>
      <td class="submitted">${row.submitted.length ? chunk(row.submitted) : "-"}</td>
      <td class="missing">${row.missing.length ? chunk(row.missing) : "-"}</td>
      <td>${row.submittedCount}/${row.totalHw}（${row.rate}%）</td>
    `;
    table.appendChild(tr);
  });

  container.appendChild(table);
}

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

// --- Meta Controls（年度セレクタ） ---
export function renderMetaControls(inputState, YEARS) {
  const el = document.getElementById("metaControls");
  if (!el) return;

  el.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin:10px 0;">
      <label>年度</label>
      <select id="yearSelect">
        ${YEARS.map(y => `
          <option value="${y}" ${inputState.year == y ? "selected" : ""}>
            ${y}
          </option>
        `).join("")}
      </select>
    </div>
  `;

  document.getElementById("yearSelect").onchange = e => {
    inputState.year = e.target.value;
    console.log("year:", inputState.year);
  };
}


// --- Firestore 状態表示 ---
export function setFirestoreStatus(user) {
  const el = document.getElementById("firestoreStatus");
  if (!el) return;

  el.textContent = user
    ? "Firestore: ログイン済み"
    : "Firestore: 未ログイン";
}
