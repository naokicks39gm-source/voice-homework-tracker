function render(state){
  renderState(state);
  renderHistory(loadAll());
}

function formatDate(ts){
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

function renderState(state){
  const submitted = [...state.submitted].sort((a, b) => a - b);
  const stateView = document.getElementById("state");

  stateView.innerHTML = `
    <div>grade: ${state.grade ?? "-"}</div>
    <div>class: ${state.classId ?? "-"}</div>
    <div>homeworkNo: ${state.homeworkNo ?? "-"}</div>
    <div>isCollecting: ${state.isCollecting}</div>
    <div>submitted: ${submitted.length ? submitted.join(", ") : "-"}</div>
  `;
}

function renderHistory(items){
  const historyView = document.getElementById("history");
  const MAX = 20;
  const view = items.slice(0, MAX);
  const lines = view
    .map((item) => `
      <div>
        ${item.grade}年${item.classId}組宿題${item.homeworkNo}
        （${formatDate(item.createdAt)}）
        : ${item.submitted.join(",") || "-"}
      </div>
    `)
    .join("<br>");

  historyView.innerHTML = lines || "保存データなし";
}
