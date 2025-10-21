
import React from 'react';

const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin h-5 w-5 text-leather" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

interface ExpressionGridProps {
    expressions: Record<string, { status: 'loading' | 'done' | 'error', image?: string }>;
}

const ExpressionGrid: React.FC<ExpressionGridProps> = ({ expressions }) => {
    const expressionKeys = Object.keys(expressions);
    if (expressionKeys.length === 0) return null;

    return (
        <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20">
            <div className="p-4">
                <h3 className="text-2xl font-heading font-bold text-sepia-dark mb-4">Expression Pack Generation</h3>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8 gap-4">
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
        </div>
    );
};

export default ExpressionGrid;