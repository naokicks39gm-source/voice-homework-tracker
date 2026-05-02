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
    console.log("TRACE_SPEECH_EVENT", JSON.stringify({
      isFinal: result.isFinal,
      text: result[0].transcript
    }));

    if (!result.isFinal) {
      return;
    }

    const text = result[0].transcript.trim();
    if (!text) {
      console.log("TRACE_SPEECH_SKIP_EMPTY");
      return;
    }

    const normalized = normalizeText(text);
    if (!normalized || normalized === lastFinalText) {
      console.log("TRACE_SPEECH_SKIP_DUPLICATE", JSON.stringify({
        normalized,
        lastFinalText
      }));
      return;
    }

    lastFinalText = normalized;
    console.log("DEBUG_FINAL", normalized);
    console.log("TRACE_SPEECH_FINAL", JSON.stringify({ normalized }));

    if (onRecognized) {
      console.log("TRACE_SPEECH_HANDLER", JSON.stringify({ normalized }));
      onRecognized(normalized);
    }
  };

  nextRecognition.onend = () => {
    console.log("TRACE_SPEECH_END");
    if (recognition === nextRecognition) {
      isRunning = false;
    }
  };

  return nextRecognition;
}

export function startSpeech() {
  console.log("TRACE_SPEECH_START", JSON.stringify({ isRunning }));
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
    console.warn("DEBUG_SPEECH_START_FAILED", error);
  }
}

export function stopSpeech() {
  console.log("TRACE_SPEECH_STOP", JSON.stringify({ hasRecognition: Boolean(recognition) }));
  if (!recognition) {
    return;
  }

  try {
    recognition.stop();
  } catch (error) {
    console.warn("DEBUG_SPEECH_STOP_FAILED", error);
  }

  isRunning = false;
  recognition = null;
}

export function setSpeechHandler(handler) {
  onRecognized = handler;
}

export function resetSpeechMemory() {
  console.log("TRACE_SPEECH_MEMORY_RESET", JSON.stringify({ lastFinalText }));
  lastFinalText = "";
}

export function dispatchRecognizedText(text) {
  const normalized = normalizeText(String(text).trim());
  if (!normalized || normalized === lastFinalText) {
    console.log("TRACE_SPEECH_SKIP_DUPLICATE", JSON.stringify({
      normalized,
      lastFinalText
    }));
    return;
  }

  lastFinalText = normalized;
  console.log("DEBUG_FINAL", normalized);
  console.log("TRACE_SPEECH_FINAL", JSON.stringify({ normalized }));

  if (onRecognized) {
    console.log("TRACE_SPEECH_HANDLER", JSON.stringify({ normalized }));
    onRecognized(normalized);
  }
}
