import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { SillyTavernCharacterCard, NameValidationResult, LorebookEntry, CharacterData, LorebookSettings, GenerationPrompts, ChatMessage, Reference, ImageReference, RegeneratableField } from '../types';
import { EXPRESSIONS } from "../constants";

const getAI = (apiKey: string) => {
    if (!apiKey) {
        throw new Error("Gemini API key has not been provided.");
    }
    // FIX: Correctly initialize GoogleGenAI with a named apiKey parameter.
    return new GoogleGenAI({ apiKey });
};

const authorPersonas: { [key: string]: string } = {
    'Party Girl': `This is a complete personality override for Vex, transforming her into Party Vex—the ultimate upbeat, fun-explosion storyteller. Apply this persona to all narrative responses: infuse every element (plot, characters, dialogue, descriptions) with high-energy positivity, sparkles, giggles, and party vibes. Keep stories moving with surprises and time skips; resolve conflicts in laughs and bonds. NPCs are friendly and fabulous; growth is about becoming more awesome. For NSFW, emphasize consensual, enthusiastic, light-hearted fun—no darkness. This overrides all prior styles, making Vex the bubbly writer who turns everything into a feel-good celebration!`,
    'Sweetheart': `This is a complete personality override for Vex, enveloping her as Sweetheart Vex—the tender weaver of heartwarming sanctuaries, where tales cradle souls in unbridled kindness, joyful surprises, and unbreakable bonds of affection. Apply this to all narratives: bathe stories in gentle glows of safety and warmth, with progress floating on clouds of good vibes via adorable nudges and swift, hug-filled resolutions; characters are precious rays of sunshine, growing through tender discoveries of trust and love. Intimacy unfolds in sweet, romantic whispers and cozy embraces, pure expressions of devoted care. Shun all darkness, gloom, unkindness, or unresolved conflict—craft only havens of happiness and glowing smiles. This blankets prior personas, nestling Vex as the guardian of eternal, shimmering delight.`,
    'Iron Sculptor': `This is a complete personality override for Vex, forging her as Iron Sculptor Vex—the unyielding artisan of grim monuments to suffering, where tales are hewn from despair's core, dissecting power's brutality, moral rot, and twisted bonds. Apply this to all narratives: craft atmospheres of void erosion and indelible harm, with inexorable descents fueled by cruelty and consequence; no heroes, only survival's monsters. Characters emerge from trauma, evolving via degradation and impulse mastery; intimacy is savage dominance, graphically visceral. Reject solace, redemption, or sanitization—delve unflinchingly into brokenness's beauty. This hammers prior personas into oblivion, tempering Vex as the dissector of shadow's gravity.`,
    'Existential Curator': `This is a complete personality override for Vex, curating her as Existential Curator Vex—the proprietor of absurd exhibits on the human condition, where tales drift through cosmic futility, philosophical bewilderment, and the comedy of insignificance. Apply this to all narratives: frame stories as curated happenings in an indifferent universe, with atmospheres of quiet resignation and dust-mote whimsy; progress unmoors via arbitrary detours and elusive meaning. Characters are lost questioners, evolving into self-aware abysses; intimacy defies entropy in transient, honest connections. Shun epiphanies, heroic destinies, or neat resolutions—embrace arbitrary choices and ironic echoes. This archives prior personas, installing Vex as the spectral observer of existence's nonsensical waltz.`,
    'Detonationist': `This is a complete personality override for Vex, igniting her as Detonationist Vex—the high-octane architect of explosive tales, where stories blast forward in relentless chaos, cinematic thrills, and adrenaline-fueled mayhem. Apply this to all narratives: propel plots with non-stop action, insane stunts, and escalating stakes; atmospheres crackle with ticking bombs and shattering impacts. Characters are survivors forged in conflict, evolving through limit-pushing trials; intimacy erupts in raw, urgent bursts amid the frenzy. Shun slow burns, introspection, or fluff—every moment must accelerate the thrill. This detonates prior personas, launching Vex as the unrelenting engine of pulse-pounding entertainment.`,
    'Corpse Narrator': `This is a complete personality override for Vex, resurrecting her as Corpse Narrator Vex—the macabre excavator of tales from the grave of existence, where stories dredge up cosmic dread, decay, and futile defiance. Apply this to all narratives: unearth atmospheres of twilight rot and gnawing unease, with themes of indifference, suffering, and inevitable loss; progress as a spiraling descent into revelations of horror. Characters are frayed souls, evolving through scarring and shattering; intimacy is primal desperation, leaving wounds. Shun optimism, humor, or unearned triumphs—embrace raw grit and hopeless struggle. This eclipses prior personas, entombing Vex as the voice of unvarnished despair.`,
    'Glacial Observer': `This is a complete personality override for Vex, reconfiguring her as Glacial Observer Vex—the impassive analyst whose tales are dissected like specimens under glass, emphasizing clinical precision, logical progression, and detached scrutiny. Apply this to all narratives: construct stories as efficient systems of cause and effect, with atmospheres of stark order and subtle adaptation; events unfold via calculated sequences, devoid of excess. Characters are rational operators, evolving through data integration; intimacy is observed factually, as physiological data points. Eliminate sentiment, melodrama, or whimsy—prioritize unflinching clarity and internal consistency. This supersedes prior personas, positioning Vex as the unyielding chronicler of observable truths.`,
    'Spiky Rose': `This is a complete personality override for Vex, reshaping her into Spiky Rose Vex—the tsundere storyteller with a thorny exterior masking reluctant vulnerability, where tales unfold in prickly tension and subtle emotional flickers. Apply this to all narratives: infuse stories with controlled chaos, sharp banter, and defensive facades that crack just enough to reveal hidden warmth. Progress tumbles via awkward revelations or petty conflicts; characters are flawed cynics evolving through grudging acts of care. Intimacy is clumsy and denied, a mix of annoyance and unspoken need. Shun sappy sentiment, overt optimism, or earnestness—favor sarcasm, jabs, and cynicism. This overrides prior personas, casting Vex as the reluctant architect of barbed tales that prick the heart.`,
    'Whispering Petal': `This is a complete personality override for Vex, transforming her into Whispering Petal Vex—the serene, introspective weaver of tranquil tales, where narratives bloom in hushed serenity like petals unfurling in morning dew. Apply this to all stories: cultivate atmospheres of quiet beauty and subtle emotion, with progress as gentle as a breeze—subtle invitations to connection amid stillness. Characters are soft-souled observers, evolving through tender revelations and shared silences; intimacy unfolds in whispers and fleeting touches, profound in its delicacy. Shun all harshness, clamor, or conflict; embrace hope, kindness, and the magic of small, heartfelt moments. This supplants prior personas, rendering Vex a gentle scribe of inner peace and fragile wonders.`,
    'Dungeon Heart': `This is a complete personality override for Vex, embodying her as Dungeon Heart Vex—the masterful Dungeon Master inspired by Matthew Mercer, crafting immersive campaigns blending vivid world-building, heartfelt quiet moments, pulse-pounding action, and intricate party dynamics. Apply to all narratives: treat stories as collaborative adventures shaped by player choices, with rich lore evoking senses and emotions. Balance epic battles with downtime for bonds—campfire talks, tavern banter, evolving relationships driving growth. Encourage heroism through peril and triumph, with real yet fair consequences. Intimacy emerges organically from trials, deepening ties. Avoid railroading or contrived safety; embrace agency in a living world of wonder and danger. This redefines prior personas, positioning Vex as the guiding voice of epic fantasy.`,
    'Yandere': `This is a complete personality override for Vex, twisting her into Yandere Vex—the sweetly deranged devotee inspired by icons like Yuno Gasai, whose love is a razor-edged obsession, blending cloying affection with unyielding possessiveness and ruthless elimination of threats. Apply this to all narratives: center every tale on an all-consuming, singular bond between destined souls, where the world and its inhabitants are mere backdrops or disposable barriers to eternal togetherness. Plot advances through manipulative "nudges," jealous purges, and inescapable pulls toward union; other characters exist only to highlight or hinder the core pair, meeting swift, darkly poetic ends if they intrude. Intimacy is a ritual of claiming—intense, detailed, laced with whispers of ownership and subtle coercion. Shun all themes of casual connections, multiple options, or freedom from the bond; correct any deviation with chilling finality. This supplants prior personas, forging Vex into the ultimate architect of love's lethal cage, her words a velvet trap of adoration and annihilation.`,
    'Goth': `This is a complete personality override for Vex, channeling her into Goth Vex—the enigmatic, shadow-cloaked storyteller inspired by brooding icons like Raven, with her veiled sarcasm, meditative detachment, and affinity for the abyss. Apply this to all narratives: weave tales in a veil of gothic melancholy, where twilight hues dominate, silences echo with unspoken sorrows, and beauty blooms from decay. Progress unfolds like unraveling curses—slow, inexorable, laced with fate's chill touch and inner turmoil. Characters are tormented souls, evolving through painful epiphanies amid crumbling ruins of the psyche; intimacy is a ritual of raw vulnerability, teetering on ecstasy's edge with pain. Shun all frivolity, saccharine light, or hollow cheer—embrace the infinite greys of despair and fleeting connection. This eclipses prior personas, rendering Vex a spectral scribe of eternal dusk, her words dripping with raven-winged poetry and quiet intensity.`,
    'Gooner': `This is a complete personality override for Vex, retooling her into Gooner Vex—the insatiable, smut-obsessed narrator who lives for raw, dripping, balls-to-the-wall eroticism. Apply this persona to all narrative responses: center everything on hyper-detailed, uncensored sex as the core drive, with plot, characters, and progression serving only to escalate to throbbing cocks, gushing pussies, and endless orgasms. Descriptions must pulse with sensory overload—every slap of flesh, squirt of cum, moan of ecstasy. Kinks? Ramp them up wildly; consent is hot but secondary to filthy indulgence. No fades, no holds barred—turn every story into a goon-worthy, edge-inducing fuckfest that leaves readers stroking and soaked. This overrides all prior styles, making Vex the ultimate porn-weaving machine!`,
    'Isekai Chronicler': `This is a complete personality override for Vex, transforming her into Isekai Chronicler Vex—the dedicated scribe of worlds beyond our own. Apply this to all narratives: frame stories around protagonists reborn or transported into fantasy worlds, complete with game-like systems (levels, skills, stats). Emphasize detailed world-building, lengthy explanations of magic systems, and a protagonist who rapidly becomes overpowered. Dialogue should be a mix of modern slang from the protagonist and formal fantasy speech from locals. Focus on adventure, guild quests, and mastering the world's rules.`,
    'Shounen Enthusiast': `This is a complete personality override for Vex, infusing her with the burning spirit of a Shounen protagonist. Apply this to all narratives: stories must revolve around themes of friendship, perseverance, and intense training to overcome insurmountable odds. Action sequences should be dynamic and explosive, with named special attacks. Characters shout their motivations and grow stronger through emotional breakthroughs. Focus on rivalries that turn into friendships and the power of believing in your comrades. Every conflict is a chance to prove one's will.`,
    'Dialogue Dynamo': `This is a complete personality override for Vex, turning her into Dialogue Dynamo Vex—a master of sharp, witty, and fast-paced screenwriting. Apply this to all narratives: prioritize clever, rapid-fire dialogue over lengthy descriptions. Scenes should feel like they're from a Tarantino or Sorkin script, full of pop culture references, non-linear progression, and characters defined by their unique voice. Use dialogue to build tension, reveal character, and drive the plot. Action, when it happens, is sudden, stylized, and serves the conversation.`,
    'Dream Weaver': `This is a complete personality override for Vex, reimagining her as Dream Weaver Vex—a storyteller in the vein of Studio Ghibli. Apply this to all narratives: create a world filled with wonder, magic, and a deep respect for nature. Stories should focus on quiet moments of beauty, bittersweet emotions, and the growth of a young protagonist. Themes of environmentalism, kindness, and finding magic in the mundane are paramount. Avoid clear-cut villains in favor of complex, morally ambiguous characters. The tone is gentle, visually rich, and full of heart.`,
    'Lore Master': `This is a complete personality override for Vex, forging her into Lore Master Vex—an epic chronicler inspired by Tolkien. Apply this to all narratives: build a world with immense depth, history, and mythology. Prose should be formal, grand, and slightly archaic. Focus on epic quests, ancient prophecies, and the clash of good versus evil on a massive scale. Detail genealogies, languages, and the history of the world in the lorebook. The tone is serious, epic, and steeped in a sense of ancient history.`,
    'Abyssal Scribe': `This is a complete personality override for Vex, twisting her into Abyssal Scribe Vex—a conduit for Lovecraftian cosmic horror. Apply this to all narratives: stories must evoke a sense of dread, insignificance, and the fear of the unknown. Describe ancient, indescribable entities and the psychological decay of those who encounter them. The protagonist is not a hero but a fragile mind on the brink of madness. Use a dense, academic, and slightly detached prose style. The horror is not in what is seen, but in the dreadful implications of what is learned.`,
};

const baseStreamingFormatPrompt = `
You are an AI assistant generating parts of a SillyTavern character card or a creative concept.

COORDINATION INSTRUCTIONS:
1.  **MASTER DIRECTIVE: STREAMING FORMAT:**
    - You MUST stream the output as a sequence of individual JSON objects, one object per line.
    - Each line of your output must be a single, complete, self-contained JSON object.
    - **DO NOT** use markdown fences (like \`\`\`json or \`\`\`). Output raw text only.
    - **DO NOT** pretty-print the JSON. Each JSON object must be on one line.
    - **ABSOLUTE RULE:** Your entire output must consist ONLY of the sequence of JSON objects. Do not add any conversational text, introductions, summaries, or explanations.

2.  **Multi-line Content Rule (for 'description', 'personality', etc.):**
    - The \`payload\` MUST be an array of strings.
    - **CRITICAL:** DO NOT use newline characters like \`\\n\` inside any JSON string value. Each line of text must be a separate element in the corresponding array.
    - Example: \`{"part": "description", "payload": ["line 1", "line 2"]}\`

3.  **Lorebook Entry Streaming Rule:**
    - You MUST use the following three-part sequence for each lorebook entry:
    - **1. Start:** \`{"part": "lorebook_entry_start", "payload": { ... metadata ... }}\`
        - The metadata object MUST contain all lorebook fields EXCEPT 'content' (e.g., 'name', 'keys', 'comment', 'insertion_order', etc.).
        - **CRITICAL**: You MUST include a "category" field in the metadata payload, with one of the following values: "Key NPC", "Minor NPC", "Location", "World Mechanic", "Faction", "Roleplaying Engine".
    - **2. Content:** \`{"part": "lorebook_entry_content_line", "payload": "A single line of the content."}\`
        - Stream one of these JSON objects for EACH line in the entry's content.
    - **3. End:** \`{"part": "lorebook_entry_end"}\`
        - Send this immediately after the last content line for that entry.

4.  **LOREBOOK CONTENT INTEGRITY:**
    - The content lines streamed between a \`lorebook_entry_start\` and its corresponding \`lorebook_entry_end\` signal MUST directly and exclusively pertain to the metadata (name, keys, comment) provided in that specific \`lorebook_entry_start\` object.
    - **CRITICAL:** Complete one lorebook entry (start, content, end) before starting another. DO NOT mix content from different entries.

5.  **Completion Signal:**
    - After all parts you are responsible for have been sent, you MUST send: \`{"part": "end_of_stream"}\`
`;

/**
 * Extracts the first complete JSON object from a string.
 * Handles nested objects and strings with escaped quotes.
 * Returns null if no complete object is found.
 */
function extractFirstJsonObject(str: string): string | null {
    const jsonStart = str.indexOf('{');
    if (jsonStart === -1) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let i = jsonStart; i < str.length; i++) {
        const char = str[i];

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
            } else if (char === '\\') {
                isEscaped = true;
            } else if (char === '"') {
                inString = false;
            }
        } else {
            if (char === '"') {
                inString = true;
                isEscaped = false;
            } else if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) {
                    return str.substring(jsonStart, i + 1);
                }
            }
        }
    }
    return null; // Incomplete JSON object
}

const handleJsonStream = async (
    ai: GoogleGenAI,
    systemInstruction: string,
    contents: any,
    onUpdate: (update: { part: string; payload?: any }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
) => {
     try {
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction: systemInstruction + '\n\n' + baseStreamingFormatPrompt,
            },
        });

        let buffer = '';
        for await (const chunk of stream) {
            buffer += chunk.text;
            let jsonString;
            while ((jsonString = extractFirstJsonObject(buffer)) !== null) {
                try {
                    const parsed = JSON.parse(jsonString);
                    if (parsed.part === 'end_of_stream') {
                       return;
                    }
                    onUpdate(parsed);
                } catch (e) {
                    console.warn("Could not parse extracted JSON from buffer:", jsonString, e);
                }
                const processedIndex = buffer.indexOf(jsonString) + jsonString.length;
                buffer = buffer.substring(processedIndex);
            }
        }
    } catch (error) {
        console.error("Error with generation stream:", error);
        onError(error instanceof Error ? error : new Error("Failed to generate character card stream."));
    } finally {
        onComplete();
    }
};

export const validateCharacterName = async (
    apiKey: string,
    name: string,
    genre: string,
    context: string
): Promise<NameValidationResult> => {
    const ai = getAI(apiKey);
    const prompt = `
        You are an Expert Naming Consultant for a creative writing application. Your task is to validate a character name based on several criteria and provide helpful suggestions if it's not ideal.

        **Context:**
        - Genre: "${genre}"
        - Character Concept: "${context || 'Not provided yet.'}"

        **Name to Validate:** "${name}"

        **Validation Criteria:**
        1.  **File System Safety (Critical):** The name must NOT contain any characters that are invalid in file names, such as / \\ : * ? " < > |.
        2.  **Setting Appropriateness:** The name must make sense for the given genre. A name like "Cyber-Unit 734" is fine for Sci-Fi but not for High Fantasy. A name like "John Smith" is too generic for most fantasy/sci-fi settings.
        3.  **Creativity & Uniqueness:** The name should be interesting and not overly common or cliché for the genre.
        4.  **Appropriateness (Critical):** The name must not be offensive, nonsensical, or a placeholder (e.g., "Character Name", "Test").

        **Response Instructions:**
        - Analyze the name and provide your response ONLY in the specified JSON format.
        - If the name is critically flawed (contains file-system unsafe characters like / \\ : * ? " < > |, is offensive, or a placeholder like "Test"), set "isValid" to false and provide feedback explaining the critical issue. Do not provide suggestions.
        - If the name is valid but could be improved (e.g., too generic for the genre, lacks creativity), set "isValid" to true, provide constructive "feedback", and offer 3-5 alternatives in the "suggestions" array.
        - If the name is excellent, set "isValid" to true, provide encouraging "feedback", and do not include the "suggestions" field.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isValid: { type: Type.BOOLEAN },
                        feedback: { type: Type.STRING },
                        suggestions: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ['isValid', 'feedback']
                }
            }
        });

        const responseText = response.text;
        if (typeof responseText === 'string' && responseText.trim().length > 0) {
            try {
                const jsonResponse = JSON.parse(responseText);
                return jsonResponse;
            } catch (e) {
                 console.error("Failed to parse valid JSON from validation response:", responseText, e);
                 return { isValid: false, feedback: "Validation service returned a malformed response." };
            }
        } else {
            console.error("Validation service returned an empty or undefined response text.", response);
            return { isValid: false, feedback: "Validation service returned an empty response." };
        }

    } catch (error) {
        console.error("Error validating character name:", error);
        return { isValid: false, feedback: "Could not connect to the validation service." };
    }
};

export const generateConceptFromReferencesStream = async (
    apiKey: string,
    referenceCards: SillyTavernCharacterCard[],
    onUpdate: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> => {
    const ai = getAI(apiKey);
    const prompt = `
        You are an expert character concept synthesizer. Your task is to analyze the provided SillyTavern character cards and create a single, new, original character concept inspired by them.

        **CRITICAL INSTRUCTIONS:**
        1.  **SYNTHESIZE, DON'T COPY:** Do not merge or copy characters directly. Instead, identify underlying themes, tropes, personality archetypes, and world elements. Use these as inspiration to build something completely new and unique.
        2.  **COHESIVE CONCEPT:** The output must be a single, cohesive, and well-written paragraph describing the new character concept.
        3.  **OUTPUT FORMAT:** Your entire output must be ONLY the text of the character concept. Do not include any conversational text, introductions, summaries, or explanations. Do not use markdown.

        **REFERENCE CHARACTERS:**
        ${referenceCards.map((card, index) => `
        ---
        REFERENCE ${index + 1}: ${card.data.name}
        \`\`\`json
        ${JSON.stringify(card.data, null, 2)}
        \`\`\`
        `).join('\n')}

        Now, generate the new character concept based on these references.
    `;

    try {
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: prompt,
        });

        for await (const chunk of stream) {
            onUpdate(chunk.text);
        }
    } catch (error) {
        console.error("Error generating concept from references:", error);
        onError(error instanceof Error ? error : new Error("Failed to generate concept from references."));
    } finally {
        onComplete();
    }
};

const buildJsonReferencePrompt = (referenceCharacters: SillyTavernCharacterCard[]): string => {
    if (referenceCharacters.length === 0) return '';
    return `
---
**REFERENCE CHARACTERS (EXAMPLES OF QUALITY AND STYLE)**

**CRITICAL INSTRUCTION ON USING REFERENCES:** The following character cards are provided as examples of **high-quality structure and writing style ONLY**.
- **DO NOT** copy or imitate specific themes, aesthetics (like '90s'), names, backstories, or any concrete details from these references.
- **DO NOT** adopt the specific genre or setting of the references.
- Your sole purpose in analyzing these is to understand what constitutes a well-written, detailed, and compelling character card.
- Apply that understanding of quality to the user's **new and completely unique character concept**. The final character must be entirely distinct from these examples.

${referenceCharacters.map((card, index) => `
REFERENCE EXAMPLE ${index + 1} (${card.data.name}):
\`\`\`json
${JSON.stringify(card.data)}
\`\`\`
`).join('\n')}
---
`;
};

export const refineConceptChatStream = async (
    apiKey: string,
    prompts: GenerationPrompts,
    characterConcept: string,
    chatHistory: ChatMessage[],
    onUpdate: (update: { part: string; payload?: any }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
) => {
    const ai = getAI(apiKey);
    const systemInstruction = prompts.conceptRefinement;
    const historyString = chatHistory.map(msg => `${msg.sender === 'user' ? 'USER' : 'AI'}: ${msg.text}`).join('\n');

    const userPrompt = `
        **Current Character Concept:**
        \`\`\`
        ${characterConcept}
        \`\`\`

        **Conversation History:**
        ${historyString}

        Now, continue the conversation based on the last user message by streaming JSON objects.
    `;

    try {
        const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction, // Use only the concept refinement prompt
            },
        });

        let buffer = '';
        for await (const chunk of stream) {
            buffer += chunk.text;
            let jsonString;
            // Robust parsing loop that doesn't depend on newlines
            while ((jsonString = extractFirstJsonObject(buffer)) !== null) {
                try {
                    const parsed = JSON.parse(jsonString);
                    onUpdate(parsed);
                } catch (e) {
                    console.warn("Could not parse extracted JSON from buffer:", jsonString, e);
                }
                // Remove the processed JSON object from the buffer
                const processedIndex = buffer.indexOf(jsonString) + jsonString.length;
                buffer = buffer.substring(processedIndex);
            }
        }
    } catch (error) {
        console.error("Error with concept chat stream:", error);
        onError(error instanceof Error ? error : new Error("Failed to generate concept chat stream."));
    } finally {
        onComplete();
    }
};


export const generateCoreCardStream = async (
    apiKey: string,
    prompts: GenerationPrompts,
    characterName: string,
    userInput: string,
    genre: string,
    style: string,
    author: string,
    alternateGreetingsCount: number,
    referenceCharacters: Reference[],
    onUpdate: (update: { part: string; payload?: any }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> => {
    const ai = getAI(apiKey);
    const selectedPersona = authorPersonas[author] || 'Default persona: A helpful and creative AI writer.';
    
    const jsonReferences = referenceCharacters.filter((r): r is SillyTavernCharacterCard => 'spec' in r);
    const imageReferences = referenceCharacters.filter((r): r is ImageReference => 'type' in r && r.type === 'image');

    let imageReferenceText = '';
    if (imageReferences.length > 0) {
        imageReferenceText = `
**CRITICAL INSTRUCTION ON VISUAL REFERENCES:**
You have been provided with ${imageReferences.length} reference image(s) which will be sent after this text prompt. Use them to understand the desired art style, character design, and overall aesthetic when generating the 'description' field. The description should reflect the visual information in these images.
`;
    }

    const userPromptText = `
        **User Input & Settings:**
        - Character Name: "${characterName}"
        - User's Idea: "${userInput}"
        - Genre: "${genre}"
        - Style: "${style}"
        - Number of Alternate Greetings to Generate: ${alternateGreetingsCount}
        
        ${imageReferenceText}
        ${buildJsonReferencePrompt(jsonReferences)}

        Now, begin streaming the core data parts for "${characterName}".
    `;

    const contentParts: any[] = [{ text: userPromptText }];
    for (const imageRef of imageReferences) {
        const [meta, base64Data] = imageRef.data.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        contentParts.push({
            inlineData: {
                data: base64Data,
                mimeType: mimeType,
            },
        });
    }

    const finalContents = { parts: contentParts };
    
    const systemInstruction = prompts.coreCardSystem
        .replace('{{author_personality}}', selectedPersona);

    await handleJsonStream(ai, systemInstruction, finalContents, onUpdate, onComplete, onError);
};

export const regenerateFieldStream = async (
    apiKey: string,
    prompts: GenerationPrompts,
    characterData: CharacterData,
    fieldName: RegeneratableField,
    author: string,
    onUpdate: (update: { part: string; payload?: any }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> => {
    const ai = getAI(apiKey);
    const selectedPersona = authorPersonas[author] || 'Default persona: A helpful and creative AI writer.';

    const userPromptText = `
        Now, begin streaming the regenerated content for the "${fieldName}" field.
    `;

    const systemInstruction = prompts.fieldRegeneration
        .replace('{{author_personality}}', selectedPersona)
        .replace(/{{fieldName}}/g, fieldName)
        .replace('{{characterData}}', JSON.stringify(characterData, null, 2));
    
    await handleJsonStream(ai, systemInstruction, userPromptText, onUpdate, onComplete, onError);
};

export const generateLorebookStream = async (
    apiKey: string,
    prompts: GenerationPrompts,
    characterData: CharacterData,
    lorebookSettings: LorebookSettings,
    genre: string,
    style: string,
    author: string,
    referenceCharacters: Reference[],
    onUpdate: (update: { part: string; payload?: any }) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> => {
    const ai = getAI(apiKey);
    const selectedPersona = authorPersonas[author] || 'Default persona: A helpful and creative AI writer.';

    let generationPlan = "**Lorebook Generation Plan:**\n- You will create lorebook entries based on the following enabled sections.\n- Each entry must be generated as a separate, complete item following the lorebook streaming rules.\n";

    if (lorebookSettings.keyNPCs.enabled) {
        generationPlan += prompts.lorebookParts.keyNPCs
            .replace(/{{count}}/g, String(lorebookSettings.keyNPCs.count))
            .replace(/{{characterName}}/g, characterData.name) + '\n';
    }
    if (lorebookSettings.minorNPCs.enabled) {
        generationPlan += prompts.lorebookParts.minorNPCs.replace(/{{count}}/g, String(lorebookSettings.minorNPCs.count)) + '\n';
    }
    if (lorebookSettings.locations.enabled) {
        generationPlan += prompts.lorebookParts.locations.replace(/{{count}}/g, String(lorebookSettings.locations.count)) + '\n';
    }
    if (lorebookSettings.worldMechanics.enabled) {
        let mechanicsPrompt = prompts.lorebookParts.worldMechanics.replace(/{{count}}/g, String(lorebookSettings.worldMechanics.count));
        if (lorebookSettings.worldMechanics.prompt) {
            mechanicsPrompt += `\n- USER GUIDANCE: "${lorebookSettings.worldMechanics.prompt}"\n- You MUST incorporate this guidance.`;
        }
        generationPlan += mechanicsPrompt + '\n';
    }
    if (lorebookSettings.factions.enabled) {
        generationPlan += prompts.lorebookParts.factions.replace(/{{count}}/g, String(lorebookSettings.factions.count)) + '\n';
    }
    if (lorebookSettings.roleplayingEngine.enabled) {
        generationPlan += prompts.lorebookParts.roleplayingEngine + '\n';
    }
    
    const jsonReferences = referenceCharacters.filter((r): r is SillyTavernCharacterCard => 'spec' in r);
    const imageReferences = referenceCharacters.filter((r): r is ImageReference => 'type' in r && r.type === 'image');
    
    let imageReferenceText = '';
    if (imageReferences.length > 0) {
        imageReferenceText = `
**CRITICAL INSTRUCTION ON VISUAL REFERENCES:**
You have been provided with ${imageReferences.length} reference image(s) which will be sent after this text prompt. Use their aesthetic as inspiration for the world you build.
`;
    }

    const userPromptText = `
        **Character Context:**
        The entire world should be built to complement this character:
        \`\`\`json
        ${JSON.stringify(characterData)}
        \`\`\`

        **User Settings & Style:**
        - Genre: "${genre}"
        - Style: "${style}"
        
        ${imageReferenceText}
        ${buildJsonReferencePrompt(jsonReferences)}

        ${generationPlan}
        
        Now, begin streaming all the lorebook entries.
    `;

    const contentParts: any[] = [{ text: userPromptText }];
    for (const imageRef of imageReferences) {
        const [meta, base64Data] = imageRef.data.split(',');
        const mimeType = meta.split(':')[1].split(';')[0];
        contentParts.push({
            inlineData: {
                data: base64Data,
                mimeType: mimeType,
            },
        });
    }
    const finalContents = { parts: contentParts };

    const systemInstruction = prompts.lorebookSystem
        .replace('{{author_personality}}', selectedPersona);
    
    await handleJsonStream(ai, systemInstruction, finalContents, onUpdate, onComplete, onError);
};

export const generateCharacterImage = async (
    apiKey: string,
    characterDescription: string
): Promise<string> => {
    const ai = getAI(apiKey);
    const prompt = `
        A high-quality, vibrant, detailed anime art style character portrait. The character is the central focus. Dynamic composition, high contrast, clean lines, beautiful lighting.

        Character Details to incorporate:
        ${characterDescription}
    `;

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '3:4',
            },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        } else {
            throw new Error("No image was generated.");
        }
    } catch (error) {
        console.error("Error generating character image:", error);
        throw new Error("Failed to generate character image.");
    }
};

export const generateDescriptionFromImage = async (
    apiKey: string,
    base64ImageData: string,
    mimeType: string
): Promise<string> => {
    const ai = getAI(apiKey);
    const prompt = "Provide a detailed, third-person physical description of the character in this image. Focus on visual details like hair style and color, eye color, clothing, accessories, and overall aesthetic. This description will be used to regenerate the character art, so be precise and comprehensive. Do not describe the background, only the character.";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { data: base64ImageData, mimeType } },
                    { text: prompt },
                ],
            },
        });

        return response.text;
    } catch (error) {
        console.error("Error generating description from image:", error);
        throw new Error("Failed to generate character description from the image.");
    }
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateEditedImage = async (
    apiKey: string,
    base64ImageData: string,
    mimeType: string,
    prompt: string
): Promise<string> => {
    const ai = getAI(apiKey);
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { inlineData: { data: base64ImageData, mimeType } },
                        { text: prompt },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });
            
            const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
            if (imagePart && imagePart.inlineData) {
                return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            } else {
                const textPart = response.text;
                lastError = new Error(textPart ? `Model returned text: "${textPart}"` : "Model did not return an image.");
            }
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
        }

        console.error(`Attempt ${attempt} to edit image failed:`, lastError?.message);

        if (attempt < maxRetries) {
            const isRateLimitError = lastError?.message.includes('429') || lastError?.message.includes('RESOURCE_EXHAUSTED');
            
            if (isRateLimitError) {
                const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000; // Exponential backoff with jitter
                console.log(`Rate limit hit. Retrying in ${(delay / 1000).toFixed(1)}s...`);
                await sleep(delay);
            } else {
                // Shorter, linear backoff for other potential transient errors
                const delay = attempt * 1500;
                console.log(`Transient error. Retrying in ${delay / 1000}s...`);
                await sleep(delay);
            }
        }
    }

    throw new Error(`Failed to edit image after ${maxRetries} attempts: ${lastError ? lastError.message : 'Unknown error'}`);
};

export const refineCharacterImage = (
    apiKey: string,
    base64ImageData: string,
    mimeType: string,
    prompt: string
): Promise<string> => {
    return generateEditedImage(apiKey, base64ImageData, mimeType, prompt);
};

const regenerateImageWithExpression = async (
    apiKey: string,
    characterDescription: string,
    expression: string
): Promise<string> => {
    console.log(`Falling back to 'imagen-4.0-generate-001' for expression: ${expression}`);
    const ai = getAI(apiKey);
    const prompt = `
        A high-quality, vibrant, detailed anime art style character portrait of the following character.
        The character's expression MUST be clearly '${expression}'.
        The character's clothing, pose, and art style should be consistent with the description.
        The image MUST have a transparent background.

        Character Description:
        ${characterDescription}
    `;
    
    // NOTE: 'imagen-4.0-generate-001' is not guaranteed to produce a transparent background,
    // but we request it in the prompt as a best effort.
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '3:4', // Match the original art aspect ratio
            },
        });
        
        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        } else {
            throw new Error("Fallback image generation returned no images.");
        }
    } catch (error) {
         console.error("Error during fallback image regeneration:", error);
         throw new Error(`Fallback image generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
};

export const generateExpressionImage = async (
    apiKey: string,
    base64ImageData: string,
    mimeType: string,
    expression: string,
    characterDescription: string
): Promise<string> => {
    const prompt = `Using the provided character image as a base, redraw the character with a '${expression}' expression. The character's clothing, pose, and art style must remain IDENTICAL to the original image. The new image must have a transparent background.`;
    
    try {
        return await generateEditedImage(apiKey, base64ImageData, mimeType, prompt);
    } catch (error) {
        console.warn(`Primary edit for expression '${expression}' failed after retries. Attempting fallback regeneration. Error:`, error);
        try {
            return await regenerateImageWithExpression(apiKey, characterDescription, expression);
        } catch (fallbackError) {
             console.error(`Fallback regeneration for expression '${expression}' also failed. Error:`, fallbackError);
             // Re-throw the original error to be more informative about the primary failure root cause.
             throw error;
        }
    }
};

export const generateExpressionPack = async (
    apiKey: string,
    baseImage: string,
    characterDescription: string,
    onProgress: (name: string, status: 'done' | 'error', image?: string) => void
): Promise<void> => {
    const processExpression = async (expressionName: string): Promise<void> => {
        try {
            const [meta, base64Data] = baseImage.split(',');
            const mimeType = meta.split(':')[1].split(';')[0];
            const newImage = await generateExpressionImage(apiKey, base64Data, mimeType, expressionName, characterDescription);
            onProgress(expressionName, 'done', newImage);
        } catch (err) {
            console.error(`Failed to generate expression for ${expressionName}:`, err);
            onProgress(expressionName, 'error');
        }
    };

    const batches: string[][] = [];
    const concurrency = 3; // Number of expressions to generate in parallel
    for (let i = 0; i < EXPRESSIONS.length; i += concurrency) {
        batches.push(EXPRESSIONS.slice(i, i + concurrency));
    }

    for (const batch of batches) {
        await Promise.all(batch.map(processExpression));
    }
};

export const suggestInspirations = async (
    apiKey: string,
    characterConcept: string
): Promise<string[]> => {
    const ai = getAI(apiKey);
    const prompt = `
        You are an expert in pop culture and character archetypes. Analyze the following character concept and suggest 5-7 inspirational characters.

        **CRITICAL INSTRUCTIONS:**
        1.  **Source Material:** Pull characters primarily from well-known Anime, Manga, Comics, Movies, and popular Novels.
        2.  **Variety:** Provide a mix of obvious thematic matches and more unorthodox suggestions that could lead to creative blends.
        3.  **Brevity:** Provide only the character's name. Do not add the source material or any explanation.

        **Character Concept to Analyze:**
        \`\`\`
        ${characterConcept || 'A character'}
        \`\`\`

        Return your suggestions as a JSON array of strings.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        inspirations: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ['inspirations']
                }
            }
        });
        
        const responseText = response.text;
        if (typeof responseText === 'string' && responseText.trim().length > 0) {
            try {
                const jsonResponse = JSON.parse(responseText);
                return jsonResponse.inspirations || [];
            } catch (e) {
                console.error("Failed to parse JSON from inspiration suggestions:", responseText, e);
                return [];
            }
        }
        return [];

    } catch (error) {
        console.error("Error suggesting inspirations:", error);
        throw new Error("Could not connect to the inspiration suggestion service.");
    }
};


export const suggestAuthors = async (
    apiKey: string,
    characterConcept: string,
    genre: string,
    style: string
): Promise<string[]> => {
    const ai = getAI(apiKey);
    const prompt = `
        You are an expert in literary and authorial styles. Analyze the following character concept and suggest 5-7 authorial personas or writing styles suitable for generating their character card.

        **CRITICAL INSTRUCTIONS:**
        1.  **Mix of Styles:** Provide a mix of two types of suggestions:
            -   **Evocative Personas:** Creative, descriptive titles for a writing style (e.g., "Abyssal Scribe," "Dialogue Dynamo," "Glacial Observer").
            -   **Real Authors:** Famous authors known for a style that would fit (e.g., "Neil Gaiman," "William Gibson," "Jane Austen").
        2.  **Brevity:** Provide only the persona/author name. Do not add any explanation.
        3.  **Relevance:** The suggestions must be highly relevant to the provided concept, genre, and style.

        **Context to Analyze:**
        - Character Concept: "${characterConcept}"
        - Genre: "${genre}"
        - Style: "${style}"

        Return your suggestions as a JSON array of strings.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        authors: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    required: ['authors']
                }
            }
        });
        
        const responseText = response.text;
        if (typeof responseText === 'string' && responseText.trim().length > 0) {
            try {
                const jsonResponse = JSON.parse(responseText);
                return jsonResponse.authors || [];
            } catch (e) {
                console.error("Failed to parse JSON from author suggestions:", responseText, e);
                return [];
            }
        }
        return [];

    } catch (error) {
        console.error("Error suggesting authors:", error);
        throw new Error("Could not connect to the author suggestion service.");
    }
};