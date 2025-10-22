import React from 'react';
import LoadingSpinner from './LoadingSpinner';

interface ExpressionProgressGridProps {
    expressions: Record<string, { status: 'loading' | 'done' | 'error', image?: string }>;
}

const ExpressionProgressGrid: React.FC<ExpressionProgressGridProps> = ({ expressions }) => {
    const expressionKeys = Object.keys(expressions);
    if (expressionKeys.length === 0) return null;

    return (
        <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-4">
            <h3 className="text-md font-bold text-sepia-dark mb-4">Expression Pack Progress</h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-2">
                {expressionKeys.map((name) => {
                    const data = expressions[name];
                    return (
                        <div key={name} className="aspect-square">
                            <div className="w-full h-full bg-parchment-dark/50 rounded-md flex flex-col items-center justify-center text-center p-1 border border-sepia-light/50">
                                <div className="flex-grow flex items-center justify-center w-full h-full">
                                    {data.status === 'loading' && <LoadingSpinner />}
                                    {data.status === 'done' && data.image && (
                                        <img src={data.image} alt={name} className="max-w-full max-h-full object-contain" />
                                    )}
                                    {data.status === 'error' && <p className="text-red-800 text-xs">Error</p>}
                                </div>
                                <span className="text-xs text-sepia mt-1 truncate w-full">{name}</span>
                            </div>
                        </div>
                    );
                 })}
            </div>
        </div>
    );
};

export default ExpressionProgressGrid;