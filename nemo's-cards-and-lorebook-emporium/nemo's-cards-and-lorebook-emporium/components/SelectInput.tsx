
import React from 'react';

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    options: string[];
}

const SelectInput: React.FC<SelectInputProps> = ({ label, options, id, ...props }) => {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-sepia mb-1">
                {label}
            </label>
            <select
                id={id}
                className="block w-full pl-3 pr-10 py-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark"
                {...props}
            >
                {options.map((option) => (
                    <option key={option} value={option}>{option}</option>
                ))}
            </select>
        </div>
    );
};

export default SelectInput;