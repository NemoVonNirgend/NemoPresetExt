/**
 * Roll Dice Tool
 * Gives tool-capable models a deterministic interface for tabletop dice rolls.
 */

import { getToolSettings } from '../tool-registry.js';

export const TOOL_NAME = 'NLG_roll_dice';

const MAX_FORMULA_LENGTH = 80;
const MAX_DICE_COUNT = 100;
const MAX_DIE_SIDES = 100000;
const TOKEN_PATTERN = /([+-]?)(\d*d\d+(?:k[hl]\d+)?|\d+)/gi;

export function getDefinition() {
    return {
        name: TOOL_NAME,
        displayName: 'Roll Dice',
        description: 'Roll dice from common tabletop notation such as d20, 1d20+5, 2d20kh1, 2d20kl1, or 4d6kh3. Use this when a random outcome is needed and act on the result.',
        parameters: {
            type: 'object',
            properties: {
                formula: {
                    type: 'string',
                    description: 'Dice formula to roll. Supported terms: NdM, dM, optional khN/klN, integer modifiers, and + or - between terms. Examples: 1d20+5, 2d20kh1, 4d6kh3.',
                },
                reason: {
                    type: 'string',
                    description: 'Optional short reason for the roll, such as "skill check" or "damage".',
                },
            },
            required: ['formula'],
        },
        action: execute,
        formatMessage: ({ formula } = {}) => `Rolling dice${formula ? `: ${formula}` : ''}...`,
        shouldRegister: () => getToolSettings(TOOL_NAME).enabled,
    };
}

export async function execute({ formula, reason } = {}) {
    try {
        const result = rollDiceFormula(formula);
        return formatDiceResult(result, reason);
    } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
}

export function rollDiceFormula(formula) {
    const normalized = String(formula || '').replace(/\s+/g, '');
    if (!normalized) {
        throw new Error('No dice formula provided.');
    }
    if (normalized.length > MAX_FORMULA_LENGTH) {
        throw new Error(`Dice formula is too long. Maximum length is ${MAX_FORMULA_LENGTH} characters.`);
    }

    const terms = parseTerms(normalized);
    if (!terms.length) {
        throw new Error('Invalid dice formula. Use notation like 1d20+5, 2d20kh1, or 4d6kh3.');
    }

    const total = terms.reduce((sum, term) => sum + term.subtotal, 0);
    return {
        formula: normalized,
        total,
        terms,
    };
}

function parseTerms(formula) {
    const terms = [];
    let consumed = '';

    for (const match of formula.matchAll(TOKEN_PATTERN)) {
        const [raw, signToken, token] = match;
        consumed += raw;
        const sign = signToken === '-' ? -1 : 1;
        terms.push(parseTerm(token.toLowerCase(), sign));
    }

    if (consumed !== formula) {
        throw new Error('Invalid dice formula. Only dice terms, integer modifiers, +, -, kh, and kl are supported.');
    }

    return terms;
}

function parseTerm(token, sign) {
    if (!token.includes('d')) {
        const value = parseInt(token, 10);
        return {
            notation: `${sign < 0 ? '-' : '+'}${token}`,
            kind: 'modifier',
            subtotal: sign * value,
        };
    }

    const match = token.match(/^(\d*)d(\d+)(?:k([hl])(\d+))?$/i);
    if (!match) {
        throw new Error(`Invalid dice term "${token}".`);
    }

    const count = parseInt(match[1] || '1', 10);
    const sides = parseInt(match[2], 10);
    const keepMode = match[3] || '';
    const keepCount = match[4] ? parseInt(match[4], 10) : count;

    if (!Number.isInteger(count) || count < 1 || count > MAX_DICE_COUNT) {
        throw new Error(`Dice count must be between 1 and ${MAX_DICE_COUNT}.`);
    }
    if (!Number.isInteger(sides) || sides < 2 || sides > MAX_DIE_SIDES) {
        throw new Error(`Die sides must be between 2 and ${MAX_DIE_SIDES}.`);
    }
    if (keepMode && (!Number.isInteger(keepCount) || keepCount < 1 || keepCount > count)) {
        throw new Error(`Keep count for "${token}" must be between 1 and the number of dice.`);
    }

    const rolls = Array.from({ length: count }, () => rollDie(sides));
    const kept = keepMode ? selectKeptRolls(rolls, keepMode, keepCount) : rolls.slice();
    const subtotal = sign * kept.reduce((sum, value) => sum + value, 0);

    return {
        notation: `${sign < 0 ? '-' : '+'}${token}`,
        kind: 'dice',
        count,
        sides,
        keepMode,
        keepCount,
        rolls,
        kept,
        subtotal,
    };
}

function selectKeptRolls(rolls, keepMode, keepCount) {
    const sorted = rolls
        .map((value, index) => ({ value, index }))
        .sort((a, b) => keepMode === 'h' ? b.value - a.value : a.value - b.value)
        .slice(0, keepCount)
        .sort((a, b) => a.index - b.index);

    return sorted.map(item => item.value);
}

function rollDie(sides) {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj?.getRandomValues) {
        const max = Math.floor(0x100000000 / sides) * sides;
        const values = new Uint32Array(1);
        do {
            cryptoObj.getRandomValues(values);
        } while (values[0] >= max);
        return (values[0] % sides) + 1;
    }

    return Math.floor(Math.random() * sides) + 1;
}

function formatDiceResult(result, reason) {
    const lines = ['Dice roll result'];
    if (reason) {
        lines.push(`Reason: ${reason}`);
    }
    lines.push(`Formula: ${result.formula}`);

    for (const term of result.terms) {
        if (term.kind === 'modifier') {
            lines.push(`${term.notation}: ${term.subtotal}`);
            continue;
        }

        const keptSuffix = term.keepMode ? `, kept [${term.kept.join(', ')}]` : '';
        lines.push(`${term.notation}: rolls [${term.rolls.join(', ')}]${keptSuffix} = ${term.subtotal}`);
    }

    lines.push(`Total: ${result.total}`);
    return lines.join('\n');
}
