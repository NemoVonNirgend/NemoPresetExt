
import React, { useState } from 'react';
import type { CharacterBook, LorebookEntry } from '../types';

interface LorebookEntryProps {
    entry: LorebookEntry;
    isOpen: boolean;
    onToggle: () => void;
}

const LorebookEntryItem: React.FC<LorebookEntryProps> = ({ entry, isOpen, onToggle }) => {
    return (
        <div className="border-b border-leather/20">
            <h2>
                <button
                    type="button"
                    className="flex items-center justify-between w-full p-4 font-medium text-left text-sepia-dark hover:bg-leather/10"
                    onClick={onToggle}
                    aria-expanded={isOpen}
                >
                    <span>{entry.name || entry.comment || entry.keys.join(', ')}</span>
                    <svg
                        className={`w-6 h-6 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </button>
            </h2>
            {isOpen && (
                <div className="p-4 bg-parchment-dark/30">
                     <p className="text-sepia whitespace-pre-wrap">{entry.content}</p>
                </div>
            )}
        </div>
    );
};


interface LorebookDisplayProps {
    characterBook: CharacterBook | null;
}

const LorebookDisplay: React.FC<LorebookDisplayProps> = ({ characterBook }) => {
    const [openEntryId, setOpenEntryId] = useState<number | null>(null);

    if (!characterBook || !characterBook.entries.length) return null;

    const handleToggle = (index: number) => {
        setOpenEntryId(openEntryId === index ? null : index);
    };

    return (
        <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20">
            <div className="rounded-lg overflow-hidden">
                 <div className="p-4 border-b border-leather/20">
                     <h3 className="text-2xl font-heading font-bold text-sepia-dark">{characterBook.name}</h3>
                     <p className="text-sepia">World & Character Lore</p>
                 </div>
                <div className="max-h-[600px] overflow-y-auto">
                    {characterBook.entries.map((entry, index) => (
                        <LorebookEntryItem
                            key={index}
                            entry={entry}
                            isOpen={openEntryId === index}
                            onToggle={() => handleToggle(index)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LorebookDisplay;