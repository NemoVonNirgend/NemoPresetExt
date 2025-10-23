import React from 'react';
import { useGeneratorContext } from '../contexts/GeneratorContext';
import type { ShowcaseItem } from '../types';

const ShowcaseCard: React.FC<{ item: ShowcaseItem, onRemove: (id: string) => void, onLoad: (item: ShowcaseItem) => void }> = ({ item, onRemove, onLoad }) => {
    return (
        <div className="relative group flex-shrink-0 w-48 h-64 rounded-lg overflow-hidden shadow-lg transform transition-transform duration-300 hover:-translate-y-2 border-2 border-leather/50">
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-0 left-0 p-3 text-white">
                <h3 className="font-bold font-heading truncate">{item.name}</h3>
            </div>
            {/* Hover overlay for actions */}
            <div className="absolute inset-0 bg-sepia-dark/80 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button
                    onClick={() => onLoad(item)}
                    className="px-4 py-2 text-sm font-semibold text-parchment bg-leather rounded-md hover:bg-opacity-90 w-3/4"
                >
                    Load
                </button>
                <button
                    onClick={() => onRemove(item.id)}
                    className="px-4 py-2 text-sm font-semibold text-sepia-dark bg-sepia-light/80 rounded-md hover:bg-sepia-light w-3/4"
                >
                    Remove
                </button>
            </div>
        </div>
    );
};


const Showcase: React.FC = () => {
    const { showcaseItems, handleRemoveFromShowcase, handleLoadFromShowcase } = useGeneratorContext();

    if (showcaseItems.length === 0) {
        return null;
    }

    return (
        <div className="mb-8">
            <h2 className="text-2xl font-heading font-bold text-sepia-dark mb-4 text-center">The Emporium's Collection</h2>
            <div className="flex gap-6 overflow-x-auto p-4 -mx-4 scrollbar-thin">
                {showcaseItems.map(item => (
                    <ShowcaseCard 
                        key={item.id} 
                        item={item} 
                        onRemove={handleRemoveFromShowcase}
                        onLoad={handleLoadFromShowcase}
                    />
                ))}
            </div>
        </div>
    );
};

export default Showcase;