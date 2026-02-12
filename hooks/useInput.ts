
import { useEffect, useRef } from 'react';

export interface InputState {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    shoot: boolean;
    special: boolean;
    dash: boolean;
    jumpCmd: boolean;
    consumeJump: () => void;
}

export const useInput = () => {
    const keysPressed = useRef<Set<string>>(new Set());
    const jumpBuffer = useRef<number>(0);
    const prevGamepadButtons = useRef<boolean[]>(new Array(20).fill(false));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            keysPressed.current.add(key);
            if (key === 'w' || key === 'arrowup' || key === ' ') {
                // Allow space for jump logic or shoot logic depending on context, 
                // but usually Space is shoot in this game. W/ArrowUp is Jump.
                if(key === 'w' || key === 'arrowup') jumpBuffer.current = 6;
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            keysPressed.current.delete(e.key.toLowerCase());
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        }
    }, []);

    const poll = (): InputState => {
        // Decrease jump buffer
        if (jumpBuffer.current > 0) jumpBuffer.current--;

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[0]; // Assuming Player 1

        let left = keysPressed.current.has('a') || keysPressed.current.has('arrowleft');
        let right = keysPressed.current.has('d') || keysPressed.current.has('arrowright');
        let up = keysPressed.current.has('w') || keysPressed.current.has('arrowup');
        let down = keysPressed.current.has('s') || keysPressed.current.has('arrowdown');
        let shoot = keysPressed.current.has(' ');
        let special = keysPressed.current.has('e');
        let dash = keysPressed.current.has('shift');
        
        if (gp) {
            const deadzone = 0.2;

            // Axes 0: Left Stick X
            if (gp.axes[0] < -deadzone || gp.buttons[14]?.pressed) left = true;
            if (gp.axes[0] > deadzone || gp.buttons[15]?.pressed) right = true;
            
            // Axes 1: Left Stick Y
            if (gp.axes[1] < -deadzone || gp.buttons[12]?.pressed) up = true;
            if (gp.axes[1] > deadzone || gp.buttons[13]?.pressed) down = true;
            
            // --- Standard Mappings ---
            // Button 0 (A / Cross): Jump
            // Button 1 (B / Circle): Dash
            // Button 2 (X / Square): Shoot
            // Button 3 (Y / Triangle): Special
            
            // Shoot: Button 2 (X) or Button 7 (R2/RT) or Button 6 (L2/LT)
            if (gp.buttons[2]?.pressed || gp.buttons[7]?.pressed || gp.buttons[6]?.pressed) shoot = true;
            
            // Special: Button 3 (Y)
            if (gp.buttons[3]?.pressed) special = true;
            
            // Dash: Button 1 (B) or Button 5 (R1/RB)
            if (gp.buttons[1]?.pressed || gp.buttons[5]?.pressed) dash = true;

            // Jump (A/Cross - Button 0) - Edge detection for better feel
            if (gp.buttons[0]?.pressed && !prevGamepadButtons.current[0]) {
                jumpBuffer.current = 6;
            }
            
            // Update previous state
            for(let i=0; i<Math.min(gp.buttons.length, 20); i++) {
                prevGamepadButtons.current[i] = gp.buttons[i].pressed;
            }
        }

        return {
            left, right, up, down, shoot, special, dash,
            jumpCmd: jumpBuffer.current > 0,
            consumeJump: () => { jumpBuffer.current = 0; }
        };
    };

    return poll;
};