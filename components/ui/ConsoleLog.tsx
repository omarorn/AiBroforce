
import React, { useEffect, useRef } from 'react';
import DecodingText from './DecodingText';

interface ConsoleLogProps {
    logs: string[];
}

const ConsoleLog: React.FC<ConsoleLogProps> = ({logs}) => {
    const endRef = useRef<HTMLDivElement>(null);
    useEffect(() => endRef.current?.scrollIntoView({behavior:'smooth'}), [logs]);

    return (
        <div className="bg-black/90 text-green-500 font-mono text-xs p-4 h-full overflow-y-auto border-2 border-green-800 shadow-[inset_0_0_20px_rgba(0,50,0,0.5)]">
            {logs.slice(0, Math.max(0, logs.length - 1)).map((log, i) => (
                <div key={i} className="mb-1 opacity-60">{`> ${log}`}</div>
            ))}
            {logs.length > 0 && (
                <div className="mb-1">
                    <span className="mr-2">&gt;</span>
                    <DecodingText 
                        text={logs[logs.length - 1]} 
                        revealSpeed={20} 
                    />
                </div>
            )}
            <div ref={endRef} />
        </div>
    )
}

export default ConsoleLog;
