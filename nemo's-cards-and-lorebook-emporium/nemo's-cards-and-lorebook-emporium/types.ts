


export interface LorebookEntry {
    keys: string[];
    secondary_keys?: string[];
    comment: string;
    content: string;
    name?: string;
    insertion_order: number;
    enabled: boolean;
    constant: boolean;
    selective: boolean;
    disable?: boolean;
    selectiveLogic?: number;
    order?: number;
    position?: number;
    addMemo?: boolean;
    excludeRecursion?: boolean;
    probability?: number;
    useProbability?: boolean;
    case_sensitive?: boolean;
    depth?: number;
    extensions?: Record<string, any>;
    selected?: boolean;
    category?: string;
}

export interface CharacterBook {
    name: string;
    entries: LorebookEntry[];
}

export interface CharacterData {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    creator_notes: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings: string[];
    tags: string[];
    character_book: CharacterBook;
    // Using a flexible extensions object
    extensions: Record<string, any>;
    // Other fields from the data object
    [key: string]: any;
}

export interface SillyTavernCharacterCard {
    spec: 'chara_card_v3';
    spec_version: string;
    data: CharacterData;
    
    // Top-level fields for v3 compatibility
    name?: string;
    description?: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    create_date?: string;

    // Other top-level fields
    [key: string]: any;
}

export interface ImageReference {
    type: 'image';
    name: string;
    data: string; // base64 data URL
}

export type Reference = SillyTavernCharacterCard | ImageReference;

export interface ShowcaseItem {
  id: string;
  name: string;
  image: string; // base64 data URL
  description: string;
  card: SillyTavernCharacterCard;
}

export interface NameValidationResult {
    isValid: boolean;
    feedback: string;
    suggestions?: string[];
}

export interface NameAuditResult {
    name: string;
    isCritical: boolean;
    feedback: string;
    suggestions?: string[];
}

export interface LorebookSettings {
    keyNPCs: { enabled: boolean; count: number };
    minorNPCs: { enabled: boolean; count: number };
    locations: { enabled: boolean; count: number };
    worldMechanics: { enabled: boolean; count: number; prompt: string };
    factions: { enabled: boolean; count: number };
    roleplayingEngine: { enabled: boolean };
    alternateGreetings: { enabled: boolean; count: number };
}

export interface GenerationPrompts {
    coreCardSystem: string;
    lorebookSystem: string;
    conceptRefinement: string;
    fieldRegeneration: string;
    lorebookParts: {
        keyNPCs: string;
        minorNPCs: string;
        locations: string;
        worldMechanics: string;
        factions: string;
        roleplayingEngine: string;
    }
}

export interface ChatMessage {
    sender: 'user' | 'ai';
    text: string;
}

export type RegeneratableField = 'description' | 'personality' | 'first_mes' | 'scenario' | 'creator_notes';