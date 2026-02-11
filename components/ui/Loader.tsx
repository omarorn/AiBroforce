
import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="w-16 h-16 border-8 border-yellow-400 border-solid border-t-transparent rounded-full animate-spin"></div>
      <p className="text-yellow-400 uppercase tracking-widest">Generating...</p>
    </div>
  );
};

export default Loader;
