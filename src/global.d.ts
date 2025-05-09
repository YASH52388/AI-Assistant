// src/global.d.ts
interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
  interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
    // Add other properties as needed
  }
  