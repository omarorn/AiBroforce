import React from 'react';

export interface MenuItem {
  title: string;
  icon: React.ReactNode;
  gradientFrom: string;
  gradientTo: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface GradientMenuProps {
  items: MenuItem[];
}

const GradientMenu: React.FC<GradientMenuProps> = ({ items }) => {
  return (
    <ul className="flex gap-4">
      {items.map(({ title, icon, gradientFrom, gradientTo, onClick, disabled }, idx) => (
        <li
          key={idx}
          style={{ '--gradient-from': gradientFrom, '--gradient-to': gradientTo } as React.CSSProperties}
          className={`relative w-[50px] h-[50px] bg-white shadow-lg rounded-full flex items-center justify-center transition-all duration-500 hover:w-[150px] hover:shadow-none group ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onClick={!disabled ? onClick : undefined}
        >
          {/* Gradient background on hover */}
          <span className={`absolute inset-0 rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] opacity-0 transition-all duration-500 ${!disabled ? 'group-hover:opacity-100' : ''}`}></span>
          {/* Blur glow */}
          <span className={`absolute top-[8px] inset-x-0 h-full rounded-full bg-[linear-gradient(45deg,var(--gradient-from),var(--gradient-to))] blur-[12px] opacity-0 -z-10 transition-all duration-500 ${!disabled ? 'group-hover:opacity-50' : ''}`}></span>

          {/* Icon */}
          <span className="relative z-10 transition-all duration-500 group-hover:scale-0 delay-0">
            <span className="text-xl text-gray-500">{icon}</span>
          </span>

          {/* Title */}
          <span className="absolute text-white uppercase tracking-wide text-xs transition-all duration-500 scale-0 group-hover:scale-100 delay-150">
            {title}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default GradientMenu;