
import React, { useState, useEffect } from 'react';

interface DecodingTextProps {
  text: string;
  className?: string;
  revealSpeed?: number; // ms per character reveal
  startDelay?: number;
  onComplete?: () => void;
  as?: any; // Component type to render as
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*?<>[]{}";

const DecodingText: React.FC<DecodingTextProps> = ({ 
  text, 
  className = "", 
  revealSpeed = 30, // Fast by default for arcade feel
  startDelay = 0,
  onComplete,
  as: Component = 'span'
}) => {
  const [displayText, setDisplayText] = useState('');
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    // Reset state when text changes
    setDisplayText('');
    setHasStarted(false);
    
    const timer = setTimeout(() => {
        setHasStarted(true);
    }, startDelay);
    
    return () => clearTimeout(timer);
  }, [text, startDelay]);

  useEffect(() => {
    if (!hasStarted) return;
    
    // Immediate check for empty text
    if (!text) {
        setDisplayText('');
        if (onComplete) onComplete();
        return;
    }

    let animationFrameId: number;
    let lastRevealTime = Date.now();
    let currentRevealIdx = 0;
    
    const animate = () => {
        const now = Date.now();
        
        // Advance reveal index based on speed
        if (now - lastRevealTime > revealSpeed) {
            currentRevealIdx++;
            lastRevealTime = now;
        }

        // Completion check
        if (currentRevealIdx >= text.length) {
            setDisplayText(text);
            if (onComplete) onComplete();
            return; 
        }

        // Construct current frame string
        let display = text.substring(0, currentRevealIdx);
        const remaining = text.length - currentRevealIdx;
        
        for (let i = 0; i < remaining; i++) {
             // Preserve spaces for better readability during scramble
             if (text[currentRevealIdx + i] === ' ') {
                 display += ' ';
             } else {
                 display += CHARS[Math.floor(Math.random() * CHARS.length)];
             }
        }
        
        setDisplayText(display);
        animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [hasStarted, text, revealSpeed, onComplete]);

  return <Component className={className}>{displayText}</Component>;
};

export default DecodingText;
