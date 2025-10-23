import React from 'react';
import { useGeneratorContext } from '../contexts/GeneratorContext';

const Header: React.FC = () => {
    const { view, setView } = useGeneratorContext();
    const activeClasses = 'bg-leather text-parchment shadow-md';
    const inactiveClasses = 'bg-transparent hover:bg-sepia-light/20 text-sepia-dark';

    return (
        <header className="p-4">
            <div className="flex justify-center bg-sepia-light/30 backdrop-blur-sm p-1 rounded-lg max-w-sm mx-auto border border-sepia-light/50">
                <button
                    onClick={() => setView('creator')}
                    className={`w-1/2 py-2 rounded-md transition-all duration-200 font-bold ${view === 'creator' ? activeClasses : inactiveClasses}`}
                >
                    Character Creator
                </button>
                <button
                    onClick={() => setView('expressionGenerator')}
                    className={`w-1/2 py-2 rounded-md transition-all duration-200 font-bold ${view === 'expressionGenerator' ? activeClasses : inactiveClasses}`}
                >
                    Expression Generator
                </button>
            </div>
        </header>
    );
};

export default Header;