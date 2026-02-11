
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({ children, className, ...props }) => {
  return (
    <button
      className={`px-6 py-3 bg-red-600 text-white font-bold uppercase tracking-wider transition-all duration-200 ease-in-out hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-400 focus:ring-opacity-50 disabled:bg-gray-500 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
