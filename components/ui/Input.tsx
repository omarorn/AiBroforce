
import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={`w-full bg-gray-800 border-2 border-gray-600 text-white px-4 py-3 focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:ring-opacity-50 focus:border-yellow-400 transition-all duration-200 ease-in-out ${className}`}
      {...props}
    />
  );
});

Input.displayName = 'Input';

export default Input;
