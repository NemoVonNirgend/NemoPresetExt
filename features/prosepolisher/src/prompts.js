// prompts.js

export const prompts = {

    // Prompt for the initial pre-screening of candidates by the Twins model
    callTwinsForSlopPreScreening: `Evaluate each phrase. Return JSON array with objects containing:
- candidate: original phrase
- valid_for_regex: true if suitable for text replacement rules, false if too short/generic/metadata
- enhanced_context: example sentence (if valid)
- reason: explanation (if invalid)

Return only the JSON array.`,

    // Prompt for the single-gremlin (Writer/Editor/etc.) regex generation
    generateAndSaveDynamicRulesWithSingleGremlin: `Create text replacement rules for repetitive phrases.

For each viable phrase, create a JSON object with:
- scriptName: descriptive name (e.g. "Prose Fix - Doubt Expression")
- findRegex: JavaScript regex with word boundaries \\b and capture groups for pronouns
- replaceString: exactly 15 alternatives in format {{random:alt1,alt2,alt3}}

Use $1, $2 for captured groups. Skip phrases that cannot generate 15 quality alternatives.

Return only a JSON array. If no rules created, return [].`,

};