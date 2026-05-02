import { normalizeText } from "./normalizer.js";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let onRecognized = null;
let recognition = null;
let isRunning = false;
let lastFinalText = "";

function createRecognition() {
  if (!SpeechRecognition) {
    return null;
  }

  const nextRecognition = new SpeechRecognition();
  nextRecognition.lang = "ja-JP";
  nextRecognition.continuous = true;
  nextRecognition.interimResults = true;

  nextRecognition.onresult = (event) => {
    const result = event.results[event.results.length - 1];

    if (!result.isFinal) {
      return;
    }

    const text = result[0].transcript.trim();
    if (!text) {
      return;
    }

    const normalized = normalizeText(text);
    if (!normalized || normalized === lastFinalText) {
      return;
    }

    lastFinalText = normalized;

    if (onRecognized) {
      onRecognized(normalized);
    }
  };

  nextRecognition.onend = () => {
    if (recognition === nextRecognition) {
      isRunning = false;
    }
  };

  return nextRecognition;
}

export function startSpeech() {
  if (isRunning) {
    return;
  }

  recognition = createRecognition();
  if (!recognition) {
    return;
  }

  try {
    recognition.start();
    isRunning = true;
  } catch (error) {
    isRunning = false;
  }
}

export function stopSpeech() {
  if (!recognition) {
    return;
  }

  try {
    recognition.stop();
  } catch (error) {
  }

  isRunning = false;
  recognition = null;
}

export function setSpeechHandler(handler) {
  onRecognized = handler;
}

export function resetSpeechMemory() {
  lastFinalText = "";
}

export function dispatchRecognizedText(text) {
  const normalized = normalizeText(String(text).trim());
  if (!normalized || normalized === lastFinalText) {
    return;
  }

  lastFinalText = normalized;

  if (onRecognized) {
    onRecognized(normalized);
  }
}
