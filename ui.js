import { get } from "./storage.js";

export function renderState(state) {
  const submitted = [...state.submitted].sort((a, b) => a - b);
  const stateView = document.getElementById("state");

  stateView.innerHTML = `
    <div>grade: ${state.grade ?? "-"}</div>
    <div>class: ${state.classId ?? "-"}</div>
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
