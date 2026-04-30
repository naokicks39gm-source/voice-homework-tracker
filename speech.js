const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const recognition = new SpeechRecognition();
recognition.lang = "ja-JP";
recognition.continuous = true;
recognition.interimResults = false;

function startRecognition(onResult){
  recognition.onresult = (e) => {
    const text = e.results[e.results.length - 1][0].transcript;
    onResult(text);
  };
  recognition.start();
}

function stopRecognition(){
  recognition.stop();
}
