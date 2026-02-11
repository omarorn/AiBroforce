import React from 'react';

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className }) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`w-full bg-gray-700 h-4 border-2 border-gray-600 ${className}`}>
      <div
        className="bg-yellow-400 h-full transition-all duration-500 ease-out"
        style={{ width: `${clampedProgress}%` }}
      ></div>
    </div>
  );
};

export default ProgressBar;
