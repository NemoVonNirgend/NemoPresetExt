

import React, { createContext, useState, useCallback, useEffect, useRef, useContext, ReactNode } from 'react';
import type { SillyTavernCharacterCard, NameValidationResult, LorebookEntry, LorebookSettings, CharacterData, GenerationPrompts, ChatMessage, Reference, RegeneratableField, ShowcaseItem } from '../types';
import { GENRES, STYLES, AUTHORS, EXPRESSIONS } from '../constants';
import { defaultPrompts } from '../prompts';
import {
    generateCoreCardStream, generateLorebookStream, refineConceptChatStream,
    suggestInspirations, suggestAuthors, regenerateFieldStream, generateConceptFromReferencesStream,
    validateCharacterName, generateExpressionPack
} from '../services/sillytavernService';
import { generateImage as generateImageDirect } from '../services/imageGenerationService';
import type { ImageSource } from '../types/imageGeneration';
import { sillyTavernIntegration } from '../sillytavern-integration';

// Types for Context
type AppStep = 'conception' | 'coreGenerationSetup' | 'generatingCore' | 'reviewAndWorldbuild';
type ExpressionPackProgress = Record<string, { status: 'loading' | 'done' | 'error', image?: string }>;

// @ts-ignore
const JSZip = window.JSZip;

interface GeneratorContextType {
    // State
    view: 'creator' | 'expressionGenerator';
    appStep: AppStep;
    characterName: string;
    characterConcept: string;
    chatHistory: ChatMessage[];
    aiSuggestions: string[];
    isConceptionAiResponding: boolean;
    isGeneratingConcept: boolean;
    isNameValidating: boolean;
    nameValidation: NameValidationResult | null;
    isSuggestingInspirations: boolean;
    inspirationSuggestions: string[];
    genre: string;
    style: string;
    author: string;
    authorSuggestions: string[];
    isSuggestingAuthors: boolean;
    characterCard: SillyTavernCharacterCard | null;
    characterImage: string | null;
    expressionPackProgress: ExpressionPackProgress;
    imageCandidates: { gemini: string | null; novelai: string | null };
    selectedImageSource: 'gemini' | 'novelai' | null;
    isLoadingGeminiImage: boolean;
    isLoadingNovelaiImage: boolean;
    geminiImageError: string | null;
    novelaiImageError: string | null;
    imageRefinementPrompt: string;
    isRefiningImage: boolean;
    isLoading: boolean;
    error: string | null;
    referenceCharacters: Reference[];
    prompts: GenerationPrompts;
    isPromptEditorOpen: boolean;
    lorebookSettings: LorebookSettings;
    isRegeneratingField: RegeneratableField | null;
    showcaseItems: ShowcaseItem[];
    imageGenApiKey: string;
    imageGenSource: ImageSource;

    // Setters & Handlers
    setView: React.Dispatch<React.SetStateAction<'creator' | 'expressionGenerator'>>;
    setAppStep: React.Dispatch<React.SetStateAction<AppStep>>;
    setCharacterName: React.Dispatch<React.SetStateAction<string>>;
    setCharacterConcept: React.Dispatch<React.SetStateAction<string>>;
    setInspirationSuggestions: React.Dispatch<React.SetStateAction<string[]>>;
    setGenre: React.Dispatch<React.SetStateAction<string>>;
    setStyle: React.Dispatch<React.SetStateAction<string>>;
    setAuthor: React.Dispatch<React.SetStateAction<string>>;
    setSelectedImageSource: React.Dispatch<React.SetStateAction<'gemini' | 'novelai' | null>>;
    setImageRefinementPrompt: React.Dispatch<React.SetStateAction<string>>;
    setPrompts: React.Dispatch<React.SetStateAction<GenerationPrompts>>;
    setIsPromptEditorOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setLorebookSettings: React.Dispatch<React.SetStateAction<LorebookSettings>>;
    setImageGenApiKey: React.Dispatch<React.SetStateAction<string>>;
    setImageGenSource: React.Dispatch<React.SetStateAction<ImageSource>>;
    handleConceptionSubmit: (message: string) => void;
    handleGenerateConceptFromReferences: () => Promise<void>;
    handleSuggestInspirations: () => Promise<void>;
    handleSuggestAuthors: () => Promise<void>;
    handleProceedToCoreGeneration: () => void;
    handleGenerateCoreCard: () => Promise<void>;
    handleUpdateCard: (updatedData: CharacterData) => void;
    handleRegenerateField: (field: RegeneratableField) => Promise<void>;
    handleGenerateLorebookAndExpressions: () => Promise<void>;
    handleGenerateImages: () => Promise<void>;
    handleApproveImage: () => void;
    handleRefineImage: () => Promise<void>;
    handleStartOver: () => void;
    handleAddReferences: (files: FileList | null) => void;
    handleRemoveReference: (index: number) => void;
    handleDownloadExpressionPack: () => Promise<void>;
    handleSaveToShowcase: () => void;
    handleRemoveFromShowcase: (id: string) => void;
    handleLoadFromShowcase: (item: ShowcaseItem) => void;
}

const GeneratorContext = createContext<GeneratorContextType | undefined>(undefined);

export const GeneratorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // All state from the original App.tsx component is moved here
    const [view, setView] = useState<'creator' | 'expressionGenerator'>('creator');

    // API keys for direct image generation
    const [imageGenApiKey, setImageGenApiKey] = useState('');
    const [imageGenSource, setImageGenSource] = useState<ImageSource>('pollinations');

    // Other API keys
    const geminiApiKey = '';
    const isInSillyTavern = true;  // Always true since this only runs in SillyTavern

    const [appStep, setAppStep] = useState<AppStep>('conception');
    const [characterName, setCharacterName] = useState<string>('');
    const [characterConcept, setCharacterConcept] = useState<string>('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [isConceptionAiResponding, setIsConceptionAiResponding] = useState(false);
    const [isGeneratingConcept, setIsGeneratingConcept] = useState<boolean>(false);
    const [isNameValidating, setIsNameValidating] = useState<boolean>(false);
    const [nameValidation, setNameValidation] = useState<NameValidationResult | null>(null);
    const [isSuggestingInspirations, setIsSuggestingInspirations] = useState<boolean>(false);
    const [inspirationSuggestions, setInspirationSuggestions] = useState<string[]>([]);
    const [genre, setGenre] = useState<string>(GENRES[0]);
    const [style, setStyle] = useState<string>(STYLES[0]);
    const [author, setAuthor] = useState<string>(AUTHORS[0]);
    const [authorSuggestions, setAuthorSuggestions] = useState<string[]>([]);
    const [isSuggestingAuthors, setIsSuggestingAuthors] = useState<boolean>(false);
    const [characterCard, setCharacterCard] = useState<SillyTavernCharacterCard | null>(null);
    const [characterImage, setCharacterImage] = useState<string | null>(null);
    const [expressionPackProgress, setExpressionPackProgress] = useState<ExpressionPackProgress>({});
    const [imageCandidates, setImageCandidates] = useState<{ gemini: string | null; novelai: string | null }>({ gemini: null, novelai: null });
    const [selectedImageSource, setSelectedImageSource] = useState<'gemini' | 'novelai' | null>(null);
    const [isLoadingGeminiImage, setIsLoadingGeminiImage] = useState(false);
    const [isLoadingNovelaiImage, setIsLoadingNovelaiImage] = useState(false);
    const [geminiImageError, setGeminiImageError] = useState<string | null>(null);
    const [novelaiImageError, setNovelaiImageError] = useState<string | null>(null);
    const [imageRefinementPrompt, setImageRefinementPrompt] = useState<string>('');
    const [isRefiningImage, setIsRefiningImage] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [referenceCharacters, setReferenceCharacters] = useState<Reference[]>([]);
    const [prompts, setPrompts] = useState<GenerationPrompts>(() => {
        try {
            const storedPrompts = localStorage.getItem('userGenerationPrompts');
            return storedPrompts ? JSON.parse(storedPrompts) : defaultPrompts;
        } catch { return defaultPrompts; }
    });
    const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
    const [lorebookSettings, setLorebookSettings] = useState<LorebookSettings>({
        keyNPCs: { enabled: true, count: 3 }, minorNPCs: { enabled: true, count: 10 },
        locations: { enabled: true, count: 10 }, worldMechanics: { enabled: true, count: 5, prompt: '' },
        factions: { enabled: true, count: 3 }, roleplayingEngine: { enabled: true },
        alternateGreetings: { enabled: true, count: 4 },
    });
    const [isRegeneratingField, setIsRegeneratingField] = useState<RegeneratableField | null>(null);
    const wipLorebookEntryRef = useRef<LorebookEntry | null>(null);

    // Showcase State
    const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>(() => {
        try {
            const stored = localStorage.getItem('nemos_emporium_showcase');
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('nemos_emporium_showcase', JSON.stringify(showcaseItems));
    }, [showcaseItems]);

    // All logic and handlers from App.tsx are moved here
    const handleDownloadExpressionPack = useCallback(async () => {
        if (!JSZip) {
            setError("JSZip library not found. Cannot create zip file.");
            return;
        }
        // FIX: Explicitly type the 'data' parameter in the filter and map callbacks to resolve issues where it was being inferred as 'unknown'.
        const generatedImages = Object.entries(expressionPackProgress)
            .filter(([, data]: [string, ExpressionPackProgress[string]]) => data.status === 'done' && data.image)
            .map(([name, data]: [string, ExpressionPackProgress[string]]) => ({ name, data: data.image! }));

        if (generatedImages.length > 0) {
            const zip = new JSZip();
            generatedImages.forEach(({ name, data }) => {
                const base64Data = data.split(',')[1];
                zip.file(`${name}.png`, base64Data, { base64: true });
            });
            const characterName = characterCard?.data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'character';
            const content = await zip.generateAsync({ type: 'blob' });
            const fileName = `${characterName}_expression_pack.zip`;
            const url = URL.createObjectURL(content);
            const a = document.createElement('a'); a.href = url; a.download = fileName;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            console.log("No successful expressions to download.");
        }
    }, [expressionPackProgress, characterCard]);

    useEffect(() => { localStorage.setItem('userGenerationPrompts', JSON.stringify(prompts)); }, [prompts]);

    // Name validation disabled in SillyTavern-only mode
    // Character names are always considered valid

    const handleConceptionStreamUpdate = useCallback((update: { part: string; payload?: any }) => {
        switch (update.part) {
            case 'conversation_chunk':
                setChatHistory(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg?.sender === 'ai') return [...prev.slice(0, -1), { ...lastMsg, text: lastMsg.text + update.payload }];
                    return [...prev, { sender: 'ai', text: update.payload }];
                }); break;
            case 'concept_update': setCharacterConcept(update.payload); break;
            case 'suggestions': setAiSuggestions(update.payload); break;
        }
    }, []);

    const handleConceptionSubmit = useCallback((message: string) => {
        setIsConceptionAiResponding(true); setError(null); setAiSuggestions([]); setInspirationSuggestions([]);
        const newHistory = [...chatHistory, { sender: 'user', text: message }];
        setChatHistory(newHistory);
        refineConceptChatStream(geminiApiKey, prompts, characterConcept, newHistory, handleConceptionStreamUpdate,
            () => setIsConceptionAiResponding(false),
            (e) => { setError(e.message); setIsConceptionAiResponding(false); }
        );
    }, [geminiApiKey, prompts, characterConcept, chatHistory, handleConceptionStreamUpdate]);

    const handleGenerateConceptFromReferences = useCallback(async () => {
        setIsGeneratingConcept(true); setError(null); setCharacterConcept('');
        const jsonReferences = referenceCharacters.filter((r): r is SillyTavernCharacterCard => 'spec' in r);
        if (jsonReferences.length === 0) {
            setError("No character card (.json) references were uploaded."); setIsGeneratingConcept(false); return;
        }
        await generateConceptFromReferencesStream(geminiApiKey, jsonReferences,
            (chunk: string) => setCharacterConcept(prev => prev + chunk),
            () => setIsGeneratingConcept(false),
            (e: Error) => { setError(e.message); setIsGeneratingConcept(false); }
        );
    }, [geminiApiKey, referenceCharacters]);

    const handleSuggestInspirations = useCallback(async () => {
        setIsSuggestingInspirations(true); setInspirationSuggestions([]); setError(null);
        try {
            const suggestions = await suggestInspirations(geminiApiKey, characterConcept);
            setInspirationSuggestions(suggestions);
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to get suggestions.'); }
        finally { setIsSuggestingInspirations(false); }
    }, [geminiApiKey, characterConcept]);

    const handleSuggestAuthors = useCallback(async () => {
        setIsSuggestingAuthors(true); setAuthorSuggestions([]); setError(null);
        try {
            const suggestions = await suggestAuthors(geminiApiKey, characterConcept, genre, style);
            setAuthorSuggestions(suggestions);
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to get author suggestions.'); }
        finally { setIsSuggestingAuthors(false); }
    }, [geminiApiKey, characterConcept, genre, style]);

    const handleProceedToCoreGeneration = () => setAppStep('coreGenerationSetup');

    const initializeNewCard = (name: string): SillyTavernCharacterCard => ({
        spec: 'chara_card_v3', spec_version: '3.0',
        data: {
            name: name, description: 'Generating...', personality: 'Generating...', scenario: 'Generating...',
            first_mes: 'Generating...', creator_notes: 'Generating...', system_prompt: 'Generating...',
            post_history_instructions: 'Generating...', alternate_greetings: [], tags: [],
            character_book: { name: `${name}'s World`, entries: [] }, extensions: {},
        }
    });

    const handleStreamUpdate = useCallback((update: { part: string; payload?: any }) => {
        setCharacterCard(prevCard => {
            if (!prevCard) return null;
            const newCard: SillyTavernCharacterCard = JSON.parse(JSON.stringify(prevCard));
            const data = newCard.data;
            const joinPayload = (payload: any): string => Array.isArray(payload) ? payload.join('\n') : String(payload);
            const appendPayload = (field: string, payload: any) => (field.startsWith('Generating...') || field.startsWith('Regenerating...') ? '' : field) + joinPayload(payload);
            switch (update.part) {
                case 'complete_card':
                    // Handle complete character card in one go
                    if (update.payload && typeof update.payload === 'object') {
                        // First, assign the data object if it exists
                        const sourceData = update.payload.data || update.payload;

                        // Map char_name to name
                        if (update.payload.char_name) {
                            data.name = update.payload.char_name;
                        }
                        // Map char_persona to personality
                        if (update.payload.char_persona) {
                            data.personality = update.payload.char_persona;
                        }
                        // Map char_greeting to first_mes
                        if (update.payload.char_greeting) {
                            data.first_mes = update.payload.char_greeting;
                        }
                        // Map world_scenario to scenario
                        if (update.payload.world_scenario) {
                            data.scenario = update.payload.world_scenario;
                        }

                        // Handle description - convert nested object to JSON string if needed
                        if (sourceData.description) {
                            if (typeof sourceData.description === 'object') {
                                data.description = JSON.stringify(sourceData.description, null, 2);
                            } else {
                                data.description = sourceData.description;
                            }
                        } else if (sourceData.Description) {
                            // Try uppercase variant
                            if (typeof sourceData.Description === 'object') {
                                data.description = JSON.stringify(sourceData.Description, null, 2);
                            } else {
                                data.description = sourceData.Description;
                            }
                        }

                        // Handle personality - convert nested object to JSON string if needed
                        if (sourceData.personality) {
                            if (typeof sourceData.personality === 'object') {
                                data.personality = JSON.stringify(sourceData.personality, null, 2);
                            } else {
                                data.personality = sourceData.personality;
                            }
                        } else if (sourceData.Personality) {
                            // Try uppercase variant
                            if (typeof sourceData.Personality === 'object') {
                                data.personality = JSON.stringify(sourceData.Personality, null, 2);
                            } else {
                                data.personality = sourceData.Personality;
                            }
                        }

                        // Copy over other fields (but skip description and personality to avoid overwriting)
                        if (update.payload.system_prompt) data.system_prompt = update.payload.system_prompt;
                        if (update.payload.post_history_instructions) data.post_history_instructions = update.payload.post_history_instructions;
                        if (update.payload.creator_notes) data.creator_notes = update.payload.creator_notes;
                        if (update.payload.tags) data.tags = update.payload.tags;
                        if (update.payload.alternate_greeting) data.alternate_greetings = update.payload.alternate_greeting;

                        // Handle nested data object - but exclude description and personality to preserve our JSON stringified versions
                        if (sourceData !== update.payload) {
                            const { description, Description, personality, Personality, ...rest } = sourceData;
                            Object.assign(data, rest);
                        }
                    }
                    break;
                case 'description': data.description = appendPayload(data.description, update.payload); break;
                case 'personality': data.personality = appendPayload(data.personality, update.payload); break;
                case 'scenario': data.scenario = appendPayload(data.scenario, update.payload); break;
                case 'first_mes': data.first_mes = appendPayload(data.first_mes, update.payload); break;
                case 'creator_notes': data.creator_notes = appendPayload(data.creator_notes, update.payload); break;
                case 'system_prompt': data.system_prompt = appendPayload(data.system_prompt || '', update.payload); break;
                case 'post_history_instructions': data.post_history_instructions = appendPayload(data.post_history_instructions || '', update.payload); break;
                case 'tags': data.tags = [...new Set([...data.tags, ...update.payload])]; break;
                case 'alternate_greeting': data.alternate_greetings.push(joinPayload(update.payload)); break;
                case 'character_book_name': data.character_book.name = update.payload; break;
                case 'lorebook_entry_start': wipLorebookEntryRef.current = { ...update.payload, content: '' }; break;
                case 'lorebook_entry_content_line': if (wipLorebookEntryRef.current) wipLorebookEntryRef.current.content += (wipLorebookEntryRef.current.content ? '\n' : '') + update.payload; break;
                case 'lorebook_entry_end': if (wipLorebookEntryRef.current) { data.character_book.entries.push(wipLorebookEntryRef.current); wipLorebookEntryRef.current = null; } break;
            }
            return newCard;
        });
    }, []);

    const handleUpdateCard = useCallback((updatedData: CharacterData) => {
        setCharacterCard(prev => {
            if (!prev) return null;
            return { ...prev, data: updatedData };
        });
    }, []);

    const handleGenerateCoreCard = useCallback(async () => {
        setIsLoading(true); setError(null); setCharacterImage(null); setAppStep('generatingCore');
        setCharacterCard(initializeNewCard(characterName));
        await generateCoreCardStream(geminiApiKey, prompts, characterName, characterConcept, genre, style, author,
            lorebookSettings.alternateGreetings.count, referenceCharacters, handleStreamUpdate,
            () => { setIsLoading(false); setAppStep('reviewAndWorldbuild'); },
            (e) => { setError(e.message); setIsLoading(false); setAppStep('conception'); }
        );
    }, [geminiApiKey, prompts, characterName, characterConcept, genre, style, author, lorebookSettings, referenceCharacters, handleStreamUpdate]);

    const handleRegenerateField = useCallback(async (field: RegeneratableField) => {
        if (!characterCard) return;
        setIsRegeneratingField(field);
        setError(null);
        // Clear the field with a placeholder
        handleUpdateCard({ ...characterCard.data, [field]: 'Regenerating...' });

        await regenerateFieldStream(
            characterCard,
            field,
            '',  // API key not needed for SillyTavern
            prompts,
            (chunk) => {
                // Update the field with the regenerated content
                handleUpdateCard({ ...characterCard.data, [field]: chunk });
            }
        ).then(() => {
            setIsRegeneratingField(null);
        }).catch((e) => {
            setError(e.message);
            setIsRegeneratingField(null);
        });

    }, [prompts, characterCard, handleUpdateCard]);


    const finalizeCard = (card: SillyTavernCharacterCard): SillyTavernCharacterCard => {
        const finalCard = { ...card };
        finalCard.name = finalCard.data.name; finalCard.description = finalCard.data.description;
        finalCard.personality = finalCard.data.personality; finalCard.scenario = finalCard.data.scenario;
        finalCard.first_mes = finalCard.data.first_mes; finalCard.tags = finalCard.data.tags;
        const d = new Date();
        finalCard.create_date = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`;
        return finalCard;
    };

    const handleGenerateLorebookAndExpressions = useCallback(async () => {
        if (!characterCard || !characterImage) return;
        setIsLoading(true); setError(null);
        setCharacterCard(prev => prev ? { ...prev, data: { ...prev.data, character_book: { ...prev.data.character_book, entries: [] } } } : null);
        const initialProgress = EXPRESSIONS.reduce((acc, name) => ({ ...acc, [name]: { status: 'loading' } }), {});
        setExpressionPackProgress(initialProgress);
        const lorebookPromise = generateLorebookStream(geminiApiKey, prompts, characterCard.data, lorebookSettings, genre, style, author, referenceCharacters, handleStreamUpdate, () => {}, (e) => setError(e.message));
        const expressionPromise = generateExpressionPack(geminiApiKey, characterImage, characterCard.data.description, (name, status, image) => {
            setExpressionPackProgress(prev => ({ ...prev, [name]: { status, image } }));
        }).catch(e => setError(e.message));
        await Promise.allSettled([lorebookPromise, expressionPromise]);
        setIsLoading(false); setCharacterCard(prev => prev ? finalizeCard(prev) : null);
        handleDownloadExpressionPack();
    }, [geminiApiKey, prompts, characterCard, characterImage, lorebookSettings, genre, style, author, referenceCharacters, handleStreamUpdate, handleDownloadExpressionPack]);

    const handleGenerateImages = useCallback(async () => {
        if (!characterCard) return;

        // Extract a usable image prompt from the description
        let imagePrompt = '';
        const desc = characterCard.data.description;

        if (typeof desc === 'string') {
            try {
                // Try to parse if it's a JSON string
                const parsed = JSON.parse(desc);
                if (parsed['◆ Appearance']?.['♦ Overview']) {
                    imagePrompt = parsed['◆ Appearance']['♦ Overview'];
                } else if (parsed.Overview) {
                    imagePrompt = parsed.Overview;
                } else {
                    // Fallback: use first text value found
                    imagePrompt = Object.values(parsed).find(v => typeof v === 'string') || desc;
                }
            } catch {
                // Not JSON, use as-is
                imagePrompt = desc;
            }
        } else if (typeof desc === 'object') {
            // Direct object access
            if (desc['◆ Appearance']?.['♦ Overview']) {
                imagePrompt = desc['◆ Appearance']['♦ Overview'];
            } else {
                imagePrompt = JSON.stringify(desc);
            }
        }

        const finalPrompt = imagePrompt || characterCard.data.name;

        // Generate using the selected source
        setImageCandidates({ gemini: null, novelai: null });
        setSelectedImageSource(null);
        setGeminiImageError(null);
        setNovelaiImageError(null);
        setIsLoadingGeminiImage(true);

        try {
            const image = await generateImageDirect(imageGenSource, finalPrompt, {
                apiKey: imageGenApiKey || undefined,
                width: 512,
                height: 768
            });

            setImageCandidates({ gemini: image, novelai: null });
            setSelectedImageSource('gemini');
        } catch (e) {
            setGeminiImageError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setIsLoadingGeminiImage(false);
        }
    }, [characterCard, imageGenSource, imageGenApiKey]);

    const handleApproveImage = useCallback(() => {
        if (selectedImageSource && imageCandidates[selectedImageSource]) {
            setCharacterImage(imageCandidates[selectedImageSource]);
        }
    }, [selectedImageSource, imageCandidates]);

    const handleRefineImage = useCallback(async () => {
        if (!selectedImageSource || !imageRefinementPrompt.trim() || !geminiApiKey.trim()) return;
        const sourceImage = imageCandidates[selectedImageSource];
        if (!sourceImage) return;
        setIsRefiningImage(true); setGeminiImageError(null);
        try {
            const [meta, base64Data] = sourceImage.split(',');
            const mimeType = meta.split(':')[1].split(';')[0];
            const newImage = await refineCharacterImage(geminiApiKey, base64Data, mimeType, imageRefinementPrompt);
            setImageCandidates({ gemini: newImage, novelai: null });
            setSelectedImageSource('gemini'); setImageRefinementPrompt('');
        } catch (e) { setGeminiImageError(e instanceof Error ? e.message : 'An unknown error occurred during image refinement.'); }
        finally { setIsRefiningImage(false); }
    }, [selectedImageSource, imageCandidates, imageRefinementPrompt, geminiApiKey]);

    const handleStartOver = () => {
        setAppStep('conception'); setCharacterName(''); setCharacterConcept(''); setChatHistory([]);
        setCharacterCard(null); setCharacterImage(null); setError(null); setNameValidation(null);
        setReferenceCharacters([]); setExpressionPackProgress({}); setImageCandidates({ gemini: null, novelai: null });
        setSelectedImageSource(null); setGeminiImageError(null); setNovelaiImageError(null);
        setIsLoading(false); setIsRefiningImage(false); setIsGeneratingEroticDetails(false);
    };

    const handleAddReferences = useCallback((files: FileList | null) => {
        if (!files) return;
        const filePromises = Array.from(files).map(file => {
            return new Promise<Reference | null>((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const content = e.target?.result as string;
                        if (file.type.startsWith('image/')) resolve({ type: 'image', name: file.name, data: content, });
                        else if (file.type === 'application/json') {
                            const parsed = JSON.parse(content);
                            let cardToStore: SillyTavernCharacterCard | null = null;
                            if (parsed.spec === 'chara_card_v3' && parsed.data) cardToStore = parsed;
                            else {
                                const cardData = parsed.data || parsed;
                                if (cardData.name) cardToStore = {
                                    spec: 'chara_card_v3', spec_version: '3.0', name: cardData.name,
                                    data: {
                                        name: cardData.name, description: cardData.description || '', personality: cardData.personality || '',
                                        scenario: cardData.scenario || '', first_mes: cardData.first_mes || '', creator_notes: cardData.creator_notes || cardData.creatorcomment || '',
                                        system_prompt: cardData.system_prompt || '', post_history_instructions: cardData.post_history_instructions || '',
                                        alternate_greetings: cardData.alternate_greetings || [], tags: cardData.tags || [],
                                        character_book: cardData.character_book || { name: '', entries: [] }, extensions: cardData.extensions || {},
                                    }
                                };
                            }
                            resolve(cardToStore);
                        } else resolve(null);
                    } catch (err) { console.error(`Error parsing file ${file.name}:`, err); resolve(null); }
                };
                reader.onerror = () => { console.error(`Error reading file ${file.name}`); resolve(null); }
                if (file.type.startsWith('image/')) reader.readAsDataURL(file);
                else if (file.type === 'application/json') reader.readAsText(file);
                else resolve(null);
            });
        });
        Promise.all(filePromises).then(results => {
            const validReferences = results.filter((ref): ref is Reference => ref !== null);
            setReferenceCharacters(prev => {
                const existingNames = new Set(prev.map(p => 'spec' in p ? p.data.name : p.name));
                const newReferences = validReferences.filter(v => !existingNames.has('spec' in v ? v.data.name : v.name));
                return [...prev, ...newReferences];
            });
        });
    }, []);

    const handleRemoveReference = useCallback((index: number) => {
        setReferenceCharacters(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleSaveToShowcase = useCallback(() => {
        if (!characterCard || !characterImage) {
            setError("Cannot save without a character card and image.");
            return;
        }
        setShowcaseItems(prev => {
            if (prev.some(item => item.name === characterCard.data.name)) {
                 setError(`${characterCard.data.name} is already in the emporium.`);
                 return prev;
            }
            const newItem: ShowcaseItem = {
                id: String(Date.now()),
                name: characterCard.data.name,
                image: characterImage,
                description: characterCard.data.description.split('\n').slice(0, 3).join('\n'),
                card: characterCard
            };
            return [newItem, ...prev];
        });
    }, [characterCard, characterImage]);
    
    const handleRemoveFromShowcase = useCallback((id: string) => {
        setShowcaseItems(prev => prev.filter(item => item.id !== id));
    }, []);
    
    const handleLoadFromShowcase = useCallback((item: ShowcaseItem) => {
        setError(null);
        setIsLoading(false);
        setExpressionPackProgress({});
        setImageCandidates({ gemini: null, novelai: null });
        setSelectedImageSource(null);
        setGeminiImageError(null);
        setNovelaiImageError(null);
        setChatHistory([]);
        setReferenceCharacters([]);
    
        setCharacterCard(item.card);
        setCharacterImage(item.image);
        setCharacterName(item.card.data.name);
        setCharacterConcept(item.card.data.creator_notes || item.card.data.description);
        
        setAppStep('reviewAndWorldbuild');
    }, []);


    const value = {
        view, setView,
        appStep, setAppStep, characterName, setCharacterName, characterConcept, setCharacterConcept, chatHistory,
        aiSuggestions, isConceptionAiResponding, isGeneratingConcept, isNameValidating, nameValidation,
        isSuggestingInspirations, inspirationSuggestions, setInspirationSuggestions, genre, setGenre, style, setStyle,
        author, setAuthor, authorSuggestions, isSuggestingAuthors, characterCard, characterImage, expressionPackProgress,
        imageCandidates, selectedImageSource, setSelectedImageSource, isLoadingGeminiImage, isLoadingNovelaiImage,
        geminiImageError, novelaiImageError, imageRefinementPrompt, setImageRefinementPrompt, isRefiningImage,
        isLoading, error, referenceCharacters, prompts, setPrompts, isPromptEditorOpen,
        setIsPromptEditorOpen, lorebookSettings, setLorebookSettings, isRegeneratingField, showcaseItems,
        imageGenApiKey, setImageGenApiKey, imageGenSource, setImageGenSource,
        handleConceptionSubmit, handleGenerateConceptFromReferences, handleSuggestInspirations,
        handleSuggestAuthors, handleProceedToCoreGeneration, handleGenerateCoreCard, handleUpdateCard,
        handleRegenerateField, handleGenerateLorebookAndExpressions, handleGenerateImages,
        handleApproveImage, handleRefineImage, handleStartOver, handleAddReferences, handleRemoveReference,
        handleDownloadExpressionPack, handleSaveToShowcase, handleRemoveFromShowcase, handleLoadFromShowcase
    };

    return (
        <GeneratorContext.Provider value={value}>
            {children}
        </GeneratorContext.Provider>
    );
};

export const useGeneratorContext = (): GeneratorContextType => {
    const context = useContext(GeneratorContext);
    if (context === undefined) {
        throw new Error('useGeneratorContext must be used within a GeneratorProvider');
    }
    return context;
};