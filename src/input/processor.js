import { normalizeText } from "../../normalizer.js";
import { parseCommand } from "../../parser.js";

let lastProcessedText = "";
let lastSavedText = "";

function extractNewPart(raw, last) {
if (!last) return raw;
if (raw.startsWith(last)) return raw.slice(last.length).trim();

const index = raw.lastIndexOf(last);
if (index !== -1) return raw.slice(index + last.length).trim();

return raw;
}

export function preprocessInput(text) {
const raw = String(text || "");
if (raw === "RESET_DONE") return null;

let processed = raw.trim();
processed = processed.replace(/^リセット[。、「」\s]*/, "");

if (lastSavedText && processed.includes(lastSavedText)) {
processed = extractNewPart(processed, lastSavedText);
}

if (!processed) return null;

if (processed === lastProcessedText) return null;
lastProcessedText = processed;

return normalizeText(processed);
}

export function buildCommand(text, resolveKey) {
const cmd = parseCommand(text);
if (!cmd) return {};

const key = resolveKey(cmd);

return { cmd, key };
}
