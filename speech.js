let onRecognized = null;

export function setSpeechHandler(handler) {
  onRecognized = handler;
}

export function dispatchRecognizedText(text) {
  if (onRecognized) {
    onRecognized(text);
  }
}
