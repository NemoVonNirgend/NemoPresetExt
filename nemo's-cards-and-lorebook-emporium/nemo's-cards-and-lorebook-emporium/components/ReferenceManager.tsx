
import React from 'react';
import type { Reference } from '../types';

interface ReferenceManagerProps {
    references: Reference[];
    onAddReferences: (files: FileList | null) => void;
    onRemoveReference: (index: number) => void;
}

const ReferenceManager: React.FC<ReferenceManagerProps> = ({ references, onAddReferences, onRemoveReference }) => {

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onAddReferences(event.target.files);
        // Reset the input so the same file can be uploaded again if removed
        event.target.value = '';
    };

    return (
        <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6">
            <h3 className="text-lg font-medium text-sepia-dark mb-2">
                Reference Materials (Optional)
            </h3>
            <p className="text-sm text-sepia mb-4">
                Upload character cards (JSON) or images (PNG, JPG). The AI will use them as inspiration for style and tone.
            </p>
            
            <label htmlFor="reference-upload" className="w-full">
                <div className="flex items-center justify-center w-full px-6 py-3 border-2 border-dashed border-sepia-light rounded-md cursor-pointer hover:bg-sepia-light/20 transition-colors">
                    <span className="text-sepia">Click to upload JSON or Image files</span>
                </div>
                <input
                    id="reference-upload"
                    type="file"
                    multiple
                    accept=".json,application/json,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                />
            </label>

            {references.length > 0 && (
                <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium text-sepia-dark">Uploaded References:</h4>
                    <ul className="max-h-40 overflow-y-auto space-y-2 pr-2">
                        {references.map((ref, index) => (
                            <li key={index} className="flex items-center justify-between bg-parchment-dark/50 p-2 rounded-md">
                                {'spec' in ref ? (
                                    <span className="text-sm text-sepia truncate" title={ref.data.name}>
                                        {ref.data.name} (JSON)
                                    </span>
                                ) : (
                                    <div className="flex items-center gap-2 truncate">
                                        <img src={ref.data} alt={ref.name} className="w-8 h-8 object-cover rounded-sm flex-shrink-0 border border-sepia-light" />
                                        <span className="text-sm text-sepia truncate" title={ref.name}>
                                            {ref.name}
                                        </span>
                                    </div>
                                )}
                                <button
                                    onClick={() => onRemoveReference(index)}
                                    className="text-red-700 hover:text-red-900 text-xs p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500 flex-shrink-0"
                                    aria-label={`Remove ${'spec' in ref ? ref.data.name : ref.name}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ReferenceManager;