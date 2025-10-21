import React from 'react';
import Tooltip from './Tooltip';
import LoadingSpinner from './LoadingSpinner';

interface EditableFieldProps {
  label: string;
  tooltipText: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  tooltipText,
  value,
  onChange,
  rows = 8,
  placeholder = '',
  disabled = false,
  onRegenerate,
  isRegenerating = false,
}) => {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="flex items-center text-sm font-bold text-sepia-dark mb-1 uppercase tracking-wider">
          {label}
          <Tooltip text={tooltipText} />
        </label>
        {onRegenerate && (
           <button
             onClick={onRegenerate}
             disabled={disabled || isRegenerating}
             className="flex items-center gap-1 text-xs text-leather hover:text-leather/80 disabled:opacity-50 disabled:cursor-wait"
             title="Regenerate this field"
           >
             {isRegenerating ? <LoadingSpinner /> : (
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10.03 2.22a.75.75 0 01.72.02l4.25 2.5a.75.75 0 010 1.32l-4.25 2.5a.75.75 0 01-.72 0l-4.25-2.5a.75.75 0 010-1.32l4.25-2.5a.75.75 0 010-.02zM6.5 6.4v5.1a.75.75 0 00.47.7l3.75 2.25a.75.75 0 00.76 0l3.75-2.25a.75.75 0 00.47-.7V6.4l-4.25 2.5a.75.75 0 01-.72 0L6.5 6.4zM3.86 4.78a.75.75 0 000 1.32l4.25 2.5a.75.75 0 00.72 0l4.25-2.5a.75.75 0 000-1.32L8.83 2.2a.75.75 0 00-.72 0L3.86 4.78z" />
                    <path d="M4.25 12.43a.75.75 0 01.75-.68h10a.75.75 0 01.75.68v.01a.75.75 0 01-.75.68h-10a.75.75 0 01-.75-.68v-.01zM4.25 15.18a.75.75 0 01.75-.68h10a.75.75 0 01.75.68v.01a.75.75 0 01-.75.68h-10a.75.75 0 01-.75-.68v-.01z" />
                 </svg>
             )}
            <span>Regenerate</span>
           </button>
        )}
      </div>
      <textarea
        rows={rows}
        className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark disabled:opacity-60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || isRegenerating}
      />
    </div>
  );
};

export default EditableField;