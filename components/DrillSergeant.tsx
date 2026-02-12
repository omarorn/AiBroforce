
import React, { useState, useRef, useEffect } from 'react';
import { generateDrillSergeantMessage } from '../services/geminiService';
import { audioService } from '../services/audioService';
import Button from './ui/Button';

const DrillSergeant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("LISTEN UP, RECRUIT! CLICK ME IF YOU DARE!");
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userQ = input;
    setInput("");
    setIsThinking(true);
    
    // Determine context based on URL or simple check (could be passed as prop later)
    const context = "User is navigating the AI Broforce game menu or playing the game.";
    
    const response = await generateDrillSergeantMessage(userQ, context);
    setMessage(response);
    audioService.playTone(100, 'square', 0.1, 0); // Beep
    setIsThinking(false);
  };

  return (
    <div className={`fixed bottom-28 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none ${isOpen ? 'pointer-events-auto' : ''}`}>
      
      {/* Chat Bubble */}
      {isOpen && (
        <div className="bg-white border-4 border-black p-4 mb-4 rounded-lg shadow-xl w-64 md:w-80 pointer-events-auto animate-bounce-in relative">
           {/* Tail centered */}
           <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-black"></div>
           <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[14px] border-t-white"></div>

           <p className="font-mono text-xs md:text-sm font-bold text-black mb-4 leading-relaxed">
             {isThinking ? "DECODING TRANSMISSION..." : message}
           </p>
           
           <form onSubmit={handleSubmit} className="flex gap-2">
             <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask for orders..."
                className="flex-grow bg-gray-200 border-2 border-gray-400 px-2 py-1 text-xs font-mono text-black focus:outline-none focus:border-black"
                disabled={isThinking}
             />
             <button 
                type="submit" 
                className="bg-green-600 text-white px-2 py-1 text-xs font-bold border-2 border-green-800 hover:bg-green-500"
                disabled={isThinking}
             >
               SIR!
             </button>
           </form>
        </div>
      )}

      {/* Avatar Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto relative group hover:scale-105 transition-transform"
      >
        <div className="w-16 h-16 md:w-20 md:h-20 bg-green-700 border-4 border-black overflow-hidden relative shadow-lg">
             {/* Pixel Art Face Placeholder */}
             <div className="absolute top-2 left-2 right-2 h-6 bg-green-900 rounded-t-sm"></div> {/* Hat */}
             <div className="absolute top-8 left-3 w-3 h-3 bg-black"></div> {/* Eye */}
             <div className="absolute top-8 right-3 w-3 h-3 bg-black"></div> {/* Eye */}
             <div className="absolute top-12 left-4 right-4 h-2 bg-black"></div> {/* Mouth */}
             <div className="absolute bottom-0 w-full h-6 bg-green-800"></div> {/* Uniform */}
        </div>
        {!isOpen && (
             <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping"></div>
        )}
      </button>
    </div>
  );
};

export default DrillSergeant;
