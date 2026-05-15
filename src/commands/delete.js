import { getNumbers, remove } from "../../storage.js";

export function handleDelete(cmd, key) {
const current = getNumbers(key) || [];

if (!cmd.nums?.length) {
// 全削除
remove(key, current);
return;
}

// 指定削除
const filtered = current.filter(n => !cmd.nums.includes(n));
remove(key, current.filter(n => !filtered.includes(n)));
}
