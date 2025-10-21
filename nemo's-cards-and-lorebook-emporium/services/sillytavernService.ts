/**
 * SillyTavern Generation Service
 * Direct integration with SillyTavern's APIs (no fallback logic)
 */

import { sillyTavernIntegration } from '../sillytavern-integration';

/**
 * Generate core character card
 */
export async function generateCoreCardStream(
    apiKey: string,
    prompts: any,
    characterName: string,
    userInput: string,
    genre: string,
    style: string,
    author: string,
    alternateGreetingsCount: number,
    referenceCharacters: any[],
    onUpdate: (update: { part: string; payload?: any }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> {
    try {
        // Build reference characters section
        const jsonReferences = referenceCharacters.filter((r: any) => 'spec' in r);
        let referenceSection = '';
        if (jsonReferences.length > 0) {
            referenceSection = `
**REFERENCE CHARACTERS (EXAMPLES OF QUALITY AND STYLE)**
The following character cards are provided as examples of high-quality structure and writing style ONLY.
DO NOT copy themes, aesthetics, names, or backstories. Use them to understand what makes a well-written character card.

${jsonReferences.map((card: any, index: number) => `
REFERENCE ${index + 1}: ${card.data.name}
\`\`\`json
${JSON.stringify(card.data, null, 2)}
\`\`\`
`).join('\n')}
`;
        }

        // Build the comprehensive prompt
        const userPromptText = `
**User Input & Settings:**
- Character Name: "${characterName}"
- User's Concept: "${userInput}"
- Genre: "${genre}"
- Style: "${style}"
- Number of Alternate Greetings: ${alternateGreetingsCount}

${referenceSection}

Now, begin generating the character card for "${characterName}" by streaming JSON objects.
`;

        // Get system instruction (use coreCardSystem if available, fallback to coreGeneration)
        const systemInstruction = prompts.coreCardSystem || prompts.coreGeneration || "Generate a detailed character card following the specified format.";

        // Build messages array
        const messages = [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPromptText }
        ];

        console.log('[ST Service] Generating core card with messages:', JSON.stringify(messages, null, 2));

        const result = await sillyTavernIntegration.generateWithHistory(messages, {
            maxTokens: 64000,
            temperature: 0.9
        });

        console.log('[ST Service] Received core card response:', result);

        // Remove markdown code fences if present
        let cleanedResult = result.trim();
        if (cleanedResult.startsWith('```json')) {
            cleanedResult = cleanedResult.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
        } else if (cleanedResult.startsWith('```')) {
            cleanedResult = cleanedResult.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
        }

        // Try to parse as a single complete JSON object first
        try {
            const parsed = JSON.parse(cleanedResult);
            // Send the complete character card
            onUpdate({ part: 'complete_card', payload: parsed });
            onComplete();
            return;
        } catch (e) {
            console.warn('[ST Service] Not a single JSON object, trying line-by-line parsing');
        }

        // Fallback: Parse JSON responses line by line
        const lines = cleanedResult.split('\n').filter(line => line.trim());
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                onUpdate(parsed);
            } catch (e) {
                // If not JSON, try to extract JSON objects from the text
                const jsonMatch = line.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
                if (jsonMatch) {
                    for (const match of jsonMatch) {
                        try {
                            const parsed = JSON.parse(match);
                            onUpdate(parsed);
                        } catch (e2) {
                            console.warn('[ST Service] Could not parse JSON from:', match);
                        }
                    }
                }
            }
        }

        onComplete();
    } catch (error) {
        console.error('[ST Service] Core card generation failed:', error);
        onError(error instanceof Error ? error : new Error('Failed to generate core card'));
    }
}

/**
 * Generate lorebook entries
 */
export async function generateLorebookStream(
    apiKey: string,
    prompts: any,
    characterData: any,
    lorebookSettings: any,
    genre: string,
    style: string,
    author: string,
    referenceCharacters: any[],
    onUpdate: (update: { part: string; payload?: any }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> {
    try {
        // Build generation plan based on enabled lorebook sections
        let generationPlan = "**Lorebook Generation Plan:**\n- You will create lorebook entries based on the following enabled sections.\n- Each entry must be generated as a separate, complete item following the lorebook streaming rules.\n";

        if (lorebookSettings.keyNPCs?.enabled) {
            generationPlan += `- Generate ${lorebookSettings.keyNPCs.count} key NPC entries related to ${characterData.name}\n`;
        }
        if (lorebookSettings.minorNPCs?.enabled) {
            generationPlan += `- Generate ${lorebookSettings.minorNPCs.count} minor NPC entries\n`;
        }
        if (lorebookSettings.locations?.enabled) {
            generationPlan += `- Generate ${lorebookSettings.locations.count} location entries\n`;
        }
        if (lorebookSettings.worldMechanics?.enabled) {
            let mechanicsText = `- Generate ${lorebookSettings.worldMechanics.count} world mechanics entries`;
            if (lorebookSettings.worldMechanics.prompt) {
                mechanicsText += `\n  USER GUIDANCE: "${lorebookSettings.worldMechanics.prompt}" - You MUST incorporate this guidance.`;
            }
            generationPlan += mechanicsText + '\n';
        }
        if (lorebookSettings.factions?.enabled) {
            generationPlan += `- Generate ${lorebookSettings.factions.count} faction entries\n`;
        }
        if (lorebookSettings.roleplayingEngine?.enabled) {
            generationPlan += `- Generate roleplaying engine entry\n`;
        }

        // Build reference characters section
        const jsonReferences = referenceCharacters.filter((r: any) => 'spec' in r);
        let referenceSection = '';
        if (jsonReferences.length > 0) {
            referenceSection = `
**REFERENCE CHARACTERS (FOR STYLE GUIDANCE)**
Use these as examples of quality lorebook structure and writing style:
${jsonReferences.map((card: any, index: number) => `
REFERENCE ${index + 1}: ${card.data.name}
${card.data.character_book ? `Has ${card.data.character_book.entries?.length || 0} lorebook entries` : 'No lorebook'}
`).join('\n')}
`;
        }

        // Build the comprehensive prompt
        const userPromptText = `
**Character Context:**
The entire world should be built to complement this character:
\`\`\`json
${JSON.stringify(characterData, null, 2)}
\`\`\`

**User Settings & Style:**
- Genre: "${genre}"
- Style: "${style}"

${referenceSection}

${generationPlan}

Now, begin generating lorebook entries by streaming JSON objects.
`;

        // Get system instruction
        const systemInstruction = prompts.lorebookSystem || prompts.lorebookGeneration || "Generate detailed lorebook entries following the specified format.";

        // Build messages array
        const messages = [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPromptText }
        ];

        console.log('[ST Service] Generating lorebook with messages:', JSON.stringify(messages, null, 2));

        const result = await sillyTavernIntegration.generateWithHistory(messages, {
            maxTokens: 6000,
            temperature: 0.9
        });

        console.log('[ST Service] Received lorebook response:', result);

        // Remove markdown code fences if present
        let cleanedResult = result.trim();
        if (cleanedResult.startsWith('```json')) {
            cleanedResult = cleanedResult.replace(/^```json\s*\n/, '').replace(/\n```\s*$/, '');
        } else if (cleanedResult.startsWith('```')) {
            cleanedResult = cleanedResult.replace(/^```\s*\n/, '').replace(/\n```\s*$/, '');
        }

        // Try to parse as a single complete JSON object first
        try {
            const parsed = JSON.parse(cleanedResult);
            // If it's a complete lorebook structure, send it
            if (parsed.entries || Array.isArray(parsed)) {
                onUpdate({ part: 'complete_lorebook', payload: parsed });
                onComplete();
                return;
            }
        } catch (e) {
            console.warn('[ST Service] Not a single JSON object, trying line-by-line parsing');
        }

        // Fallback: Parse JSON responses line by line
        const lines = cleanedResult.split('\n').filter(line => line.trim());
        for (const line of lines) {
            try {
                const parsed = JSON.parse(line);
                onUpdate(parsed);
            } catch (e) {
                // If not JSON, try to extract JSON objects from the text
                const jsonMatch = line.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
                if (jsonMatch) {
                    for (const match of jsonMatch) {
                        try {
                            const parsed = JSON.parse(match);
                            onUpdate(parsed);
                        } catch (e2) {
                            console.warn('[ST Service] Could not parse lorebook JSON from:', match);
                        }
                    }
                }
            }
        }

        onComplete();
    } catch (error) {
        console.error('[ST Service] Lorebook generation failed:', error);
        onError(error instanceof Error ? error : new Error('Failed to generate lorebook'));
    }
}

/**
 * Refine concept via chat
 */
export async function refineConceptChatStream(
    apiKey: string,
    prompts: any,
    characterConcept: string,
    chatHistory: any[],
    onUpdate: (update: { part: string; payload?: any }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> {
    try {
        // Build the system instruction
        const systemInstruction = prompts.conceptRefinement || "You are helping refine a character concept.";

        // Build messages array with proper conversation history
        const messages = [];

        // Add system prompt
        messages.push({
            role: 'system',
            content: `${systemInstruction}

**Current Character Concept:**
\`\`\`
${characterConcept}
\`\`\`

Now, continue the conversation based on the user's message by streaming JSON objects following the specified format.`
        });

        // Add conversation history
        for (const msg of chatHistory) {
            messages.push({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            });
        }

        console.log('[ST Service] Sending messages to LLM:', JSON.stringify(messages, null, 2));

        const result = await sillyTavernIntegration.generateWithHistory(messages, {
            maxTokens: 2000,
            temperature: 0.9
        });

        console.log('[ST Service] Received response:', result);

        // Parse JSON responses from the result
        // The LLM may wrap JSON in backticks, so we need to extract them
        const lines = result.split('\n').filter(line => line.trim());
        for (const line of lines) {
            // Remove backticks if present
            const cleanLine = line.replace(/^`|`$/g, '').trim();

            if (!cleanLine) continue;

            try {
                const parsed = JSON.parse(cleanLine);
                onUpdate(parsed);
            } catch (e) {
                console.warn('[ST Service] Could not parse line as JSON:', cleanLine);
                // If not JSON, treat as text response
                onUpdate({ part: 'text', payload: cleanLine });
            }
        }

        onComplete();
    } catch (error) {
        console.error('[ST Service] Concept refinement failed:', error);
        onError(error instanceof Error ? error : new Error('Failed to refine concept'));
    }
}

/**
 * Suggest character inspirations
 */
export async function suggestInspirations(genre: string, style: string, apiKey: string): Promise<string[]> {
    const result = await sillyTavernIntegration.generateText(
        `Suggest 5 character inspirations for ${genre} genre in ${style} style`,
        { maxTokens: 200 }
    );

    // Parse result into array
    return result.split('\n').filter(line => line.trim()).map(line => line.replace(/^\d+\.\s*/, '').trim());
}

/**
 * Suggest authors
 */
export async function suggestAuthors(genre: string, style: string, apiKey: string): Promise<string[]> {
    const result = await sillyTavernIntegration.generateText(
        `Suggest 5 authors known for ${genre} genre in ${style} style`,
        { maxTokens: 200 }
    );

    return result.split('\n').filter(line => line.trim()).map(line => line.replace(/^\d+\.\s*/, '').trim());
}

/**
 * Regenerate a specific field
 */
export async function regenerateFieldStream(
    card: any,
    field: string,
    apiKey: string,
    prompts: any,
    onStream: (chunk: string) => void
): Promise<void> {
    const result = await sillyTavernIntegration.generateText(
        `Regenerate the ${field} for character: ${card.data.name}`,
        { maxTokens: 500 }
    );

    onStream(result);
}

/**
 * Generate concept from references
 */
export async function generateConceptFromReferencesStream(
    references: any[],
    apiKey: string,
    onStream: (chunk: string) => void
): Promise<void> {
    const referenceText = references.map(ref => `${ref.name}: ${ref.description}`).join('\n');
    const result = await sillyTavernIntegration.generateText(
        `Generate a character concept based on these references:\n${referenceText}`,
        {
            systemPrompt: "You are helping create a character concept based on provided references.",
            maxTokens: 500
        }
    );

    onStream(result);
}

/**
 * Generate character image
 */
export async function generateCharacterImage(description: string, apiKey: string): Promise<string> {
    console.log('[ST Service] Generating image via SillyTavern');
    return await sillyTavernIntegration.generateImage(description, {
        width: 512,
        height: 768
    });
}

/**
 * Dummy implementations for functions that aren't needed in SillyTavern
 */
export async function refineCharacterImage(imageData: string, feedback: string, apiKey: string): Promise<string> {
    // Image refinement not implemented - just return original
    console.warn('[ST Service] Image refinement not implemented');
    return imageData;
}

export async function validateCharacterName(name: string, apiKey: string): Promise<boolean> {
    // Name validation not needed - always valid
    return true;
}

export async function generateExpressionPack(character: any, apiKey: string, onProgress: (expr: string, status: string) => void): Promise<any> {
    // Expression pack generation not implemented
    console.warn('[ST Service] Expression pack generation not implemented');
    return {};
}
