
import React, { useEffect, useRef } from 'react';

export const useGameLoop = (callback: (deltaTime: number) => void) => {
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const callbackRef = useRef(callback);

  // Update the ref to the latest callback whenever it changes.
  // This ensures the loop always calls the most recent version of the game logic
  // which has access to the latest state.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const loop = (time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      callbackRef.current(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if(requestRef.current){
          cancelAnimationFrame(requestRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
