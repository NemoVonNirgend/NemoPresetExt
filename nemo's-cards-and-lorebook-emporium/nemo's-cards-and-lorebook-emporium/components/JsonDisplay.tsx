
import React from 'react';
import type { SillyTavernCharacterCard } from '../types';
import Button from './Button';

interface JsonDisplayProps {
    characterCard: SillyTavernCharacterCard | null;
}

const JsonDisplay: React.FC<JsonDisplayProps> = ({ characterCard }) => {
    if (!characterCard) return null;

    const formattedJson = JSON.stringify(characterCard, null, 2);

    const handleDownload = () => {
        const characterName = characterCard.data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `${characterName}.json`;
        const blob = new Blob([JSON.stringify(characterCard)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20">
            <div className="rounded-lg overflow-hidden">
                <div className="p-4 flex justify-between items-center border-b border-leather/20">
                    <div>
                        <h3 className="text-2xl font-heading font-bold text-sepia-dark">Generated Character Card</h3>
                        <p className="text-sepia">SillyTavern JSON Format</p>
                    </div>
                    <Button onClick={handleDownload} variant="secondary">Download JSON</Button>
                </div>
                <pre className="p-4 text-xs text-sepia-dark overflow-x-auto max-h-[600px] bg-parchment-dark/30">
                    <code>
                        {formattedJson}
                    </code>
                </pre>
            </div>
        </div>
    );
};

export default JsonDisplay;