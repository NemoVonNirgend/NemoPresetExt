import React from 'react';

interface TooltipProps {
  text: string;
}

const Tooltip: React.FC<TooltipProps> = ({ text }) => {
  return (
    <span className="group/tooltip relative ml-1.5">
      <span className="w-5 h-5 cursor-help rounded-full bg-sepia-light text-parchment flex items-center justify-center text-xs font-bold ring-1 ring-sepia">?</span>
      <span className="absolute bottom-full mb-2 w-72 p-3 bg-sepia-dark border border-sepia-light text-parchment text-sm rounded-md shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-20">
        {text}
      </span>
    </span>
  );
};

export default Tooltip;