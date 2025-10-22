import React, { useState, useCallback } from 'react';
import { EXPRESSIONS } from '../constants';
import { generateExpressionPack, generateDescriptionFromImage } from '../services/geminiService';
import Button from './Button';
import ExpressionGrid from './ExpressionGrid';
import { useGeneratorContext } from '../contexts/GeneratorContext';

// @ts-ignore
const JSZip = window.JSZip;

const ExpressionPackGenerator: React.FC = () => {
    const { geminiApiKey: apiKey } = useGeneratorContext();
    const [baseImage, setBaseImage] = useState<string | null>(null);
    const [characterDescription, setCharacterDescription] = useState<string>('');
    const [expressions, setExpressions] = useState<Record<string, { status: 'loading' | 'done' | 'error', image?: string }>>({});
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isDescribing, setIsDescribing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const imageDataUrl = reader.result as string;
                setBaseImage(imageDataUrl);
                setExpressions({}); // Reset expressions if a new image is uploaded
                setCharacterDescription(''); // Clear old description
                setError(null);

                if (!apiKey.trim()) {
                    setError("API Key is not set. Please set it before uploading an image for auto-description.");
                    return;
                }

                setIsDescribing(true);
                try {
                    const [meta, base64Data] = imageDataUrl.split(',');
                    const mimeType = meta.split(':')[1].split(';')[0];
                    const description = await generateDescriptionFromImage(apiKey, base64Data, mimeType);
                    setCharacterDescription(description);
                } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to generate description.");
                    setCharacterDescription("Could not automatically generate a description. Please provide one manually.");
                } finally {
                    setIsDescribing(false);
                }
            };
            reader.readAsDataURL(file);
        }
        event.target.value = ''; // Allow re-uploading the same file
    };
    
    const handleGenerate = useCallback(async () => {
        if (!baseImage || !characterDescription.trim() || !apiKey.trim()) {
            setError("Please upload a reference image, provide a character description, and ensure your API key is set.");
            return;
        }
        setIsGenerating(true);
        setError(null);
        
        // Set initial loading state for all expressions
        const initialExpressions = EXPRESSIONS.reduce((acc, name) => ({ ...acc, [name]: { status: 'loading' } }), {});
        setExpressions(initialExpressions);

        await generateExpressionPack(apiKey, baseImage, characterDescription, (name, status, image) => {
            setExpressions(prev => ({...prev, [name]: { status, image }}));
        });
       
        setIsGenerating(false);

    }, [baseImage, characterDescription, apiKey]);
    
    const handleDownloadZip = async () => {
        const generatedImages = Object.keys(expressions)
            .filter((name) => expressions[name].status === 'done' && expressions[name].image)
            .map((name) => ({ name, data: expressions[name].image! }));

        if (generatedImages.length > 0) {
            const zip = new JSZip();
            generatedImages.forEach(({ name, data }) => {
                const base64Data = data.split(',')[1];
                zip.file(`${name}.png`, base64Data, { base64: true });
            });
            
            const content = await zip.generateAsync({ type: 'blob' });
            const fileName = `expression_pack.zip`;
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            setError("No expressions were successfully generated to create a zip file.");
        }
    };
    
    const expressionsDoneCount = Object.values(expressions).filter((e: { status: 'loading' | 'done' | 'error' }) => e.status === 'done').length;
    const allDone = expressionsDoneCount === EXPRESSIONS.length;

    return (
        <div className="space-y-8">
            <div className="border border-leather/30 bg-parchment/80 backdrop-blur-sm rounded-lg shadow-lg shadow-black/20 p-6 space-y-6">
                <div className="space-y-4">
                    <div>
                        <label className="block text-lg font-medium text-sepia-dark mb-2">
                            1. Upload Reference Portrait
                        </label>
                        <div className="w-full max-w-sm h-64 bg-parchment-dark rounded-lg flex items-center justify-center border-2 border-dashed border-sepia-light mx-auto">
                            {baseImage ? (
                                <img src={baseImage} alt="Reference" className="max-w-full max-h-full object-contain rounded-md" />
                            ) : (
                                <p className="text-sepia">Image preview</p>
                            )}
                        </div>
                         <input
                            id="expression-image-upload"
                            type="file"
                            accept="image/png, image/jpeg, image/webp"
                            className="block w-full max-w-sm mx-auto text-sm text-sepia file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-leather/10 file:text-leather hover:file:bg-leather/20 mt-2"
                            onChange={handleImageUpload}
                        />
                    </div>
                    <div>
                        <label htmlFor="char-desc" className="block text-lg font-medium text-sepia-dark mb-2">
                            2. Provide Character Description
                        </label>
                        <p className="text-sm text-sepia mb-2">
                            This is crucial for the AI to regenerate the character if image editing fails. Use the description from the character card for best results.
                        </p>
                        <textarea
                            id="char-desc"
                            rows={6}
                            className="block w-full p-2 text-base bg-parchment-dark/50 border-sepia-light focus:outline-none focus:ring-leather focus:border-leather sm:text-sm rounded-md text-sepia-dark disabled:opacity-60 disabled:cursor-wait"
                            placeholder={isDescribing ? "AI is generating a description from your image..." : "e.g., A tall elf with long silver hair, wearing green robes..."}
                            value={characterDescription}
                            onChange={(e) => setCharacterDescription(e.target.value)}
                            disabled={isDescribing}
                        />
                    </div>
                    <div>
                         <h3 className="text-lg font-medium text-sepia-dark mb-2">
                            3. Generate & Download
                        </h3>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button
                                onClick={handleGenerate}
                                isLoading={isGenerating}
                                disabled={!baseImage || !characterDescription.trim() || !apiKey.trim() || isGenerating || isDescribing}
                                className="flex-1"
                            >
                                {isGenerating ? `Generating... (${expressionsDoneCount}/${EXPRESSIONS.length})` : 'Generate Expression Pack'}
                            </Button>
                            <Button
                                onClick={handleDownloadZip}
                                disabled={isGenerating || expressionsDoneCount === 0}
                                variant="secondary"
                                className="flex-1"
                            >
                                Download as .zip
                            </Button>
                        </div>
                         {error && (
                            <div className="bg-red-500/10 border border-red-500/30 text-red-900 p-3 rounded-lg text-sm mt-4">
                                <p>{error}</p>
                            </div>
                        )}
                        {allDone && !isGenerating && (
                             <div className="bg-green-500/10 border border-green-500/30 text-green-900 p-3 rounded-lg text-sm mt-4">
                                <p>All expressions generated successfully! You can now download the .zip file.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            <ExpressionGrid expressions={expressions} />
        </div>
    );
};

export default ExpressionPackGenerator;