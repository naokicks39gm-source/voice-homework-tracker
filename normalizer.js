import { DICTIONARY } from "./config.js";

const NUMBER_DICT = {
  "後": "5",
  "ご": "5",
  "五": "5",
  "いち": "1",
  "一": "1",
  "に": "2",
  "二": "2",
  "さん": "3",
  "三": "3",
  "よん": "4",
  "四": "4",
  "ろく": "6",
  "六": "6",
  "なな": "7",
  "七": "7",
  "はち": "8",
  "八": "8",
  "きゅう": "9",
  "九": "9",
  "じゅう": "10"
};

export function normalizeNumbers(text) {
  let normalized = text;

  Object.entries(NUMBER_DICT).forEach(([key, value]) => {
    normalized = normalized.replaceAll(key, value);
  });

  return normalized;
}

export function normalizeText(text) {
  let normalized = text;

  Object.entries(DICTIONARY).forEach(([key, value]) => {
    normalized = normalized.replaceAll(key, value);
  });

  normalized = normalizeNumbers(normalized);

  return normalized;
}

export function getLastLine(text) {
  const lines = text.split("\n");
  return lines[lines.length - 1] || "";
}

export function normalizeClass(value) {
  const normalized = value
    .replace(/[Ａ-Ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .toUpperCase();
  const map = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
    F: 6
  };

  return map[normalized] ?? null;
}
