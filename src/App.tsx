import { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff, Bot } from 'lucide-react';
import { CohereClientV2 } from 'cohere-ai';
import { motion, AnimatePresence } from 'framer-motion';

// Declare global window properties

// Initialize Cohere API
const cohere = new CohereClientV2({
  token: import.meta.env.VITE_COHERE_API_KEY,
});

// Web Speech API for speech recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;  

interface Message {
  role: 'user' | 'assistant'; // Restrict to known roles
  content: string;
}

// Define SpeechRecognitionEvent and SpeechRecognitionError if not available
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionError {
  error: string;
}


export default function VoiceChatBot() {
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); // New state for generation status
  const [typingInterval, setTypingInterval] = useState<NodeJS.Timeout | null>(null); // Manage typing interval

  const handleNewChat = () => {
    setMessages([]); // Clear the messages
    setInputText(''); // Clear the input text
    setErrorMessage(null); // Reset any error messages
    setLoading(false); // Reset loading state
  };
  

  const startListening = () => {
    if (!recognition) {
      setErrorMessage('Speech recognition not supported in this browser.');
      return;
    }
    recognition.start();
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
    }
  }; 

  const stopGenerating = () => {
    setIsGenerating(false); // Set generation status to false
    speechSynthesis.cancel(); // Cancel any ongoing speech synthesis
    setLoading(false); // Stop loading state

    // Clear the typing interval if it's running
    if (typingInterval) {
      clearInterval(typingInterval);
      setTypingInterval(null);
    }
  };

  const handleSendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: messageContent,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setErrorMessage(null);
    setLoading(true);
    setIsGenerating(true); // Set generating state to true

    try {
      const response = await cohere.chat({
        model: 'command-r-plus-08-2024',
        messages: [...messages.map((msg) => ({ role: msg.role, content: msg.content })), userMessage],
      });

      const assistantMessageContent =
        response.message?.content && response.message.content.length > 0
          ? response.message.content[0]?.text
          : 'No response from assistant.';

      const utterance = new SpeechSynthesisUtterance(assistantMessageContent);
      speechSynthesis.speak(utterance);
      typeEffect(assistantMessageContent);
    } catch (error) {
      console.error('Error calling Cohere API:', error);
      setErrorMessage('Error: Unable to fetch response.');
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error occurred.' }]);
    } finally {
      setLoading(false);
      setIsGenerating(false); // Reset generation status
    }
  }, [messages]);

 
  const typeEffect = (messageContent: string) => {
    let displayContent = '';
    let index = 0;

    const interval = setInterval(() => {
      if (index < messageContent.length) {
        displayContent += messageContent[index];
        index++;
        setMessages((prev) => {
          const updatedMessages = [...prev];
          const lastMessage = updatedMessages.pop();

          if (lastMessage && lastMessage.role === 'assistant') {
            updatedMessages.push({ role: 'assistant', content: displayContent });
          } else {
            if (lastMessage) updatedMessages.push(lastMessage);
            updatedMessages.push({ role: 'assistant', content: displayContent });
          }

          return updatedMessages;
        });
      } else {
        clearInterval(interval);
      }
    }, 50);

    setTypingInterval(interval); // Store the interval ID
  };

   

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening]);

  useEffect(() => {
    if (recognition) {
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        handleSendMessage(transcript);
      };
      recognition.onerror = (event: SpeechRecognitionError) => {
        console.error('Speech recognition error:', event.error);
        setErrorMessage('Error during speech recognition: ' + event.error);
      };
    }
    return () => {
      if (recognition) {
        recognition.onstart = null;
        recognition.onend = null;
        recognition.onresult = null;
        recognition.onerror = null;
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-200 flex flex-col">
     <header className="bg-white shadow-md p-4 flex justify-between items-center">
  <div className="flex items-center">
    <Bot className="text-purple-600 mr-2" size={32} />
    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600">
      AI Chat Bot
    </h1>
  </div>
  <button
    onClick={handleNewChat}
    className="bg-purple-500 text-white px-4 py-2 rounded-full shadow-lg hover:bg-purple-600"
  >
    + New
  </button>
</header>

      <main className="flex-1 p-4 overflow-auto">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-auto">
          <AnimatePresence>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className={`p-4 rounded-xl ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white ml-auto'
                    : 'bg-gray-100'
                } max-w-[80%] shadow-md`}
              >
                <p className={`${message.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                  {message.content}
                </p>
              </motion.div>
            ))}
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="p-4 bg-gray-100 rounded-xl shadow-md max-w-[80%]"
              >
                <p className="text-gray-800">Typing...</p>
              </motion.div>
            )}
          </AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="p-4 bg-red-100 text-red-700 rounded-xl shadow-md"
            >
              {errorMessage}
            </motion.div>
          )}
        </div>
      </main>
      <footer className="p-4">
        <div className="max-w-4xl mx-auto flex items-center space-x-2">
          <button
            onClick={toggleListening}
            className={`p-3 rounded-full ${isListening ? 'bg-green-500' : 'bg-red-500' } text-white shadow-lg`}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-3 border rounded-lg shadow-md"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSendMessage(inputText);
              }
            }}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSendMessage(inputText)}
            className="p-3 rounded-full bg-purple-500 text-white shadow-lg transition-colors duration-300"
            aria-label="Send message"
          />
      
          <button
            onClick={stopGenerating}
            className="p-3 rounded-full bg-red-500 text-white shadow-lg"
            aria-label="Stop generation"
          >
            Stop
          </button>
        </div>
      </footer>
    </div>
  );
}
