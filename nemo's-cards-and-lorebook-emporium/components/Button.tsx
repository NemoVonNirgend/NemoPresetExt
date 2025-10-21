
import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ isLoading = false, children, className, variant = 'primary', ...props }) => {
    const baseClasses = "inline-flex items-center justify-center px-6 py-3 border text-base font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-parchment transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-px";

    const variantClasses = {
        primary: 'text-parchment bg-leather border-leather-dark shadow-md shadow-black/20 hover:bg-opacity-90 focus:ring-leather',
        secondary: 'text-sepia-dark bg-sepia-light/50 border-sepia-light hover:bg-sepia-light/80 focus:ring-sepia'
    };

    return (
        <button
            type="button"
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            disabled={isLoading || props.disabled}
            {...props}
        >
            {isLoading && <LoadingSpinner />}
            {children}
        </button>
    );
};

export default Button;