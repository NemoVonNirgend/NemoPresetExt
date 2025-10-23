// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - Example Asset Pack Library
// Collection of ready-to-use asset pack examples

export const ExampleAssetPacks = {

    /**
     * 1. Enhanced Dating Simulator
     */
    datingSimulator: {
        id: "dating-simulator",
        metadata: {
            name: "dating-simulator",
            displayName: "💕 Dating Simulator",
            version: "1.0.0",
            description: "Track relationship progression with affection, trust, and compatibility",
            author: "Ember Team",
            tags: ["dating", "relationship", "romance", "interactive"]
        },
        stateSchema: {
            variables: {
                Affection: {
                    type: "number",
                    default: 45,
                    min: 0,
                    max: 100,
                    description: "Romantic affection level"
                },
                Trust: {
                    type: "number",
                    default: 35,
                    min: 0,
                    max: 100,
                    description: "Trust and emotional bond"
                },
                Compatibility: {
                    type: "number",
                    default: 50,
                    min: 0,
                    max: 100,
                    description: "Long-term compatibility"
                },
                Likes: {
                    type: "array",
                    default: ["coffee", "books", "music"],
                    description: "Things the character enjoys"
                },
                Dislikes: {
                    type: "array",
                    default: ["loud noises", "spicy food"],
                    description: "Things the character dislikes"
                },
                RelationshipStage: {
                    type: "string",
                    default: "acquaintance",
                    description: "Current relationship status"
                },
                DateCount: {
                    type: "number",
                    default: 0,
                    min: 0,
                    description: "Number of dates"
                }
            }
        },
        chatInjection: {
            template: `Relationship Status:
- Affection: {{Affection}}/100 ❤️
- Trust: {{Trust}}/100 🤝
- Compatibility: {{Compatibility}}/100 💫
- Stage: {{RelationshipStage}}
- Dates: {{DateCount}}
- Likes: {{Likes}}
- Dislikes: {{Dislikes}}

[Update these stats based on our interactions using STATE_UPDATE format. Positive interactions increase affection (+5-15), trust-building increases trust (+3-12), shared interests boost compatibility (+2-8).]`,
            stateUpdateFormat: "[STATE_UPDATE]....[/STATE_UPDATE]",
            instructions: "Track relationship development realistically. Update affection for romantic moments, trust for vulnerability/honesty, compatibility for shared values. Progress relationship stage at milestones: friend (60+ affection), close friend (75+ affection + 65+ trust), dating (85+ affection + 80+ trust + 70+ compatibility)."
        },
        positioning: { type: "end" },
        content: `
const affection = getState('Affection') || 45;
const trust = getState('Trust') || 35;
const compatibility = getState('Compatibility') || 50;
const stage = getState('RelationshipStage') || 'acquaintance';
const dates = getState('DateCount') || 0;
const likes = getState('Likes') || [];
const dislikes = getState('Dislikes') || [];

const container = document.createElement('div');
container.style.cssText = \`
    background: linear-gradient(135deg, #ff6b9d 0%, #c44569 50%, #8e44ad 100%);
    border-radius: 20px;
    padding: 25px;
    color: white;
    box-shadow: 0 15px 35px rgba(0,0,0,0.2);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 400px;
    margin: 10px 0;
\`;

function createStatBar(label, value, icon, color) {
    const percentage = Math.min(100, Math.max(0, value));
    return \`
        <div style="margin: 12px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-weight: 600;">\${icon} \${label}</span>
                <span style="font-weight: bold; font-size: 14px;">\${percentage}/100</span>
            </div>
            <div style="background: rgba(0,0,0,0.25); border-radius: 12px; padding: 3px; overflow: hidden;">
                <div style="
                    background: linear-gradient(90deg, \${color}22 0%, \${color} 100%);
                    height: 10px;
                    border-radius: 10px;
                    width: \${percentage}%;
                    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                "></div>
            </div>
        </div>
    \`;
}

function getStageEmoji(stage) {
    const stages = {
        'acquaintance': '👋',
        'friend': '😊',
        'close_friend': '🤗',
        'dating': '💕',
        'committed': '💍'
    };
    return stages[stage] || '❓';
}

container.innerHTML = \`
    <div style="text-align: center; margin-bottom: 20px;">
        <h3 style="margin: 0; font-size: 22px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            \${getStageEmoji(stage)} Dating Simulator
        </h3>
        <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">Relationship Status: \${stage.replace('_', ' ')}</p>
    </div>

    \${createStatBar('Affection', affection, '❤️', '#ff4757')}
    \${createStatBar('Trust', trust, '🤝', '#2ed573')}
    \${createStatBar('Compatibility', compatibility, '💫', '#a55eea')}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0;">
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 4px;">📅</div>
            <div style="font-size: 12px; opacity: 0.9;">Dates</div>
            <div style="font-weight: bold; font-size: 16px;">\${dates}</div>
        </div>
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 4px;">🎯</div>
            <div style="font-size: 12px; opacity: 0.9;">Overall</div>
            <div style="font-weight: bold; font-size: 16px;">\${Math.round((affection + trust + compatibility) / 3)}/100</div>
        </div>
    </div>

    <div style="margin: 15px 0;">
        <details style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 12px;">
            <summary style="cursor: pointer; font-weight: 600; outline: none;">👍 Likes (\${likes.length})</summary>
            <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
                \${likes.map(like => \`<span style="background: rgba(46, 213, 115, 0.3); padding: 4px 10px; border-radius: 15px; font-size: 12px; border: 1px solid rgba(46, 213, 115, 0.5);">\${like}</span>\`).join('')}
                \${likes.length === 0 ? '<span style="opacity: 0.7; font-style: italic;">None discovered yet</span>' : ''}
            </div>
        </details>
    </div>

    <div style="margin: 15px 0;">
        <details style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 12px;">
            <summary style="cursor: pointer; font-weight: 600; outline: none;">👎 Dislikes (\${dislikes.length})</summary>
            <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
                \${dislikes.map(dislike => \`<span style="background: rgba(255, 71, 87, 0.3); padding: 4px 10px; border-radius: 15px; font-size: 12px; border: 1px solid rgba(255, 71, 87, 0.5);">\${dislike}</span>\`).join('')}
                \${dislikes.length === 0 ? '<span style="opacity: 0.7; font-style: italic;">None discovered yet</span>' : ''}
            </div>
        </details>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
        <button onclick="
            updateState({Affection: '+8', Trust: '+2'});
            injectPrompt('I gave a thoughtful compliment that made them smile. This should increase affection and show I pay attention to them.');
        " style="
            background: rgba(255, 71, 87, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            💕 Compliment
        </button>

        <button onclick="
            updateState({Affection: '+12', Trust: '+5', DateCount: '+1'});
            injectPrompt('We went on a wonderful date together. This was a significant bonding experience that should increase both affection and trust.');
        " style="
            background: rgba(165, 94, 234, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0,0,0,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            🌟 Plan Date
        </button>
    </div>
\`;

root.appendChild(container);`
    },

    /**
     * 2. RPG Character Sheet
     */
    rpgCharacter: {
        id: "rpg-character",
        metadata: {
            name: "rpg-character",
            displayName: "⚔️ RPG Character Sheet",
            version: "1.0.0",
            description: "Complete RPG character management with stats, inventory, and progression",
            author: "Ember Team",
            tags: ["rpg", "character", "stats", "gaming"]
        },
        stateSchema: {
            variables: {
                Health: {
                    type: "number",
                    default: 100,
                    min: 0,
                    max: 100,
                    description: "Current health points"
                },
                Mana: {
                    type: "number",
                    default: 80,
                    min: 0,
                    max: 100,
                    description: "Current mana points"
                },
                Experience: {
                    type: "number",
                    default: 150,
                    min: 0,
                    description: "Total experience points"
                },
                Level: {
                    type: "number",
                    default: 3,
                    min: 1,
                    description: "Character level"
                },
                Strength: {
                    type: "number",
                    default: 14,
                    min: 1,
                    max: 20,
                    description: "Physical strength"
                },
                Intelligence: {
                    type: "number",
                    default: 16,
                    min: 1,
                    max: 20,
                    description: "Mental acuity"
                },
                Dexterity: {
                    type: "number",
                    default: 12,
                    min: 1,
                    max: 20,
                    description: "Agility and reflexes"
                },
                Gold: {
                    type: "number",
                    default: 250,
                    min: 0,
                    description: "Currency amount"
                },
                Equipment: {
                    type: "array",
                    default: ["Iron Sword", "Leather Armor", "Health Potion"],
                    description: "Equipped items and inventory"
                }
            }
        },
        chatInjection: {
            template: `Character Stats:
Level {{Level}} Adventurer
- Health: {{Health}}/100 ❤️
- Mana: {{Mana}}/100 💙
- Experience: {{Experience}} XP
- STR: {{Strength}} | INT: {{Intelligence}} | DEX: {{Dexterity}}
- Gold: {{Gold}} coins
- Equipment: {{Equipment}}

[Update stats based on combat, exploration, and story events using STATE_UPDATE format]`,
            stateUpdateFormat: "[STATE_UPDATE]....[/STATE_UPDATE]",
            instructions: "Update stats based on actions: combat reduces health (-10 to -40), magic use drains mana (-5 to -25), victories grant experience (+25 to +150). Level up at experience thresholds (level * 100). Modify attributes for permanent upgrades. Update equipment and gold for loot and purchases."
        },
        positioning: { type: "right" },
        content: `
const health = getState('Health') || 100;
const mana = getState('Mana') || 80;
const exp = getState('Experience') || 150;
const level = getState('Level') || 3;
const str = getState('Strength') || 14;
const int = getState('Intelligence') || 16;
const dex = getState('Dexterity') || 12;
const gold = getState('Gold') || 250;
const equipment = getState('Equipment') || [];

const container = document.createElement('div');
container.style.cssText = \`
    background: linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #9b59b6 100%);
    border-radius: 15px;
    padding: 20px;
    color: white;
    font-family: 'Courier New', monospace;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    max-width: 280px;
    border: 2px solid rgba(255,255,255,0.1);
\`;

function createResourceBar(label, current, max, color) {
    const percentage = Math.min(100, (current / max) * 100);
    return \`
        <div style="margin: 8px 0;">
            <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>\${label}</span>
                <span>\${current}/\${max}</span>
            </div>
            <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 2px; border: 1px solid rgba(255,255,255,0.2);">
                <div style="
                    background: linear-gradient(90deg, \${color}, \${color}88);
                    height: 8px;
                    border-radius: 6px;
                    width: \${percentage}%;
                    transition: width 0.6s ease;
                    box-shadow: 0 0 10px \${color}44;
                "></div>
            </div>
        </div>
    \`;
}

function getStatModifier(stat) {
    return Math.floor((stat - 10) / 2);
}

const expNeeded = level * 100;
const expProgress = (exp / expNeeded) * 100;

container.innerHTML = \`
    <div style="text-align: center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 10px;">
        <h3 style="margin: 0; font-size: 18px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">⚔️ CHARACTER</h3>
        <div style="font-size: 14px; opacity: 0.9;">Level \${level} Adventurer</div>
    </div>

    \${createResourceBar('❤️ Health', health, 100, '#e74c3c')}
    \${createResourceBar('💙 Mana', mana, 100, '#3498db')}

    <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
            <span>⭐ Experience</span>
            <span>\${exp}/\${expNeeded}</span>
        </div>
        <div style="background: rgba(0,0,0,0.4); border-radius: 8px; padding: 2px; border: 1px solid rgba(255,255,255,0.2);">
            <div style="
                background: linear-gradient(90deg, #f39c12, #e67e22);
                height: 8px;
                border-radius: 6px;
                width: \${Math.min(100, expProgress)}%;
                transition: width 0.6s ease;
                box-shadow: 0 0 10px #f39c1244;
            "></div>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 15px 0; font-size: 11px;">
        <div style="background: rgba(231, 76, 60, 0.2); padding: 8px; border-radius: 6px; text-align: center; border: 1px solid rgba(231, 76, 60, 0.4);">
            <div style="font-weight: bold;">STR</div>
            <div style="font-size: 16px; margin: 4px 0;">\${str}</div>
            <div style="opacity: 0.8;">(\${getStatModifier(str) >= 0 ? '+' : ''}\${getStatModifier(str)})</div>
        </div>
        <div style="background: rgba(52, 152, 219, 0.2); padding: 8px; border-radius: 6px; text-align: center; border: 1px solid rgba(52, 152, 219, 0.4);">
            <div style="font-weight: bold;">INT</div>
            <div style="font-size: 16px; margin: 4px 0;">\${int}</div>
            <div style="opacity: 0.8;">(\${getStatModifier(int) >= 0 ? '+' : ''}\${getStatModifier(int)})</div>
        </div>
        <div style="background: rgba(46, 204, 113, 0.2); padding: 8px; border-radius: 6px; text-align: center; border: 1px solid rgba(46, 204, 113, 0.4);">
            <div style="font-weight: bold;">DEX</div>
            <div style="font-size: 16px; margin: 4px 0;">\${dex}</div>
            <div style="opacity: 0.8;">(\${getStatModifier(dex) >= 0 ? '+' : ''}\${getStatModifier(dex)})</div>
        </div>
    </div>

    <div style="background: rgba(241, 196, 15, 0.2); border-radius: 8px; padding: 10px; margin: 12px 0; border: 1px solid rgba(241, 196, 15, 0.4);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
            <span style="font-size: 20px;">💰</span>
            <span style="font-weight: bold; font-size: 16px;">\${gold.toLocaleString()} Gold</span>
        </div>
    </div>

    <div style="margin: 12px 0;">
        <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 4px;">
            🎒 Equipment (\${equipment.length})
        </div>
        <div style="max-height: 100px; overflow-y: auto; font-size: 11px;">
            \${equipment.length > 0
                ? equipment.map(item => \`
                    <div style="background: rgba(255,255,255,0.1); margin: 2px 0; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #9b59b6;">
                        \${item}
                    </div>
                \`).join('')
                : '<div style="opacity: 0.7; font-style: italic; text-align: center; padding: 10px;">No equipment</div>'
            }
        </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 15px;">
        <button onclick="
            const newHealth = Math.min(100, health + 30);
            const newMana = Math.min(100, mana + 20);
            updateState({Health: newHealth, Mana: newMana});
            injectPrompt('I rested and recovered health and mana.');
        " style="
            background: rgba(46, 204, 113, 0.8);
            border: none;
            color: white;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: bold;
            transition: all 0.3s ease;
        ">🛌 Rest</button>

        <button onclick="
            updateState({Experience: '+50'});
            injectPrompt('I completed a quest and gained experience.');
        " style="
            background: rgba(155, 89, 182, 0.8);
            border: none;
            color: white;
            padding: 8px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
            font-weight: bold;
            transition: all 0.3s ease;
        ">⚡ Train</button>
    </div>
\`;

root.appendChild(container);`
    },

    /**
     * 3. Pet Care Simulator
     */
    petCare: {
        id: "pet-care",
        metadata: {
            name: "pet-care",
            displayName: "🐾 Pet Care Simulator",
            version: "1.0.0",
            description: "Take care of your virtual pet with feeding, playing, and bonding",
            author: "Ember Team",
            tags: ["pet", "care", "simulation", "virtual"]
        },
        stateSchema: {
            variables: {
                Happiness: {
                    type: "number",
                    default: 75,
                    min: 0,
                    max: 100,
                    description: "Pet's happiness level"
                },
                Hunger: {
                    type: "number",
                    default: 30,
                    min: 0,
                    max: 100,
                    description: "Pet's hunger level (higher = more hungry)"
                },
                Energy: {
                    type: "number",
                    default: 60,
                    min: 0,
                    max: 100,
                    description: "Pet's energy level"
                },
                Health: {
                    type: "number",
                    default: 90,
                    min: 0,
                    max: 100,
                    description: "Pet's health condition"
                },
                Cleanliness: {
                    type: "number",
                    default: 80,
                    min: 0,
                    max: 100,
                    description: "How clean the pet is"
                },
                Age: {
                    type: "number",
                    default: 5,
                    min: 0,
                    description: "Pet's age in days"
                },
                LastActivity: {
                    type: "string",
                    default: "sleeping",
                    description: "What the pet was last doing"
                }
            }
        },
        chatInjection: {
            template: `Pet Status:
- Happiness: {{Happiness}}/100 😊
- Hunger: {{Hunger}}/100 🍽️
- Energy: {{Energy}}/100 ⚡
- Health: {{Health}}/100 ❤️
- Cleanliness: {{Cleanliness}}/100 🛁
- Age: {{Age}} days old
- Last Activity: {{LastActivity}}

[Update pet stats based on care activities and time passage using STATE_UPDATE format]`,
            stateUpdateFormat: "[STATE_UPDATE]....[/STATE_UPDATE]",
            instructions: "Update pet stats based on interactions: feeding reduces hunger (-20 to -40), playing increases happiness (+10 to +20) but uses energy (-10 to -20), resting restores energy (+30 to +50), bathing improves cleanliness (+40 to +60). Neglect gradually reduces stats over time."
        },
        positioning: { type: "end" },
        content: `
const happiness = getState('Happiness') || 75;
const hunger = getState('Hunger') || 30;
const energy = getState('Energy') || 60;
const health = getState('Health') || 90;
const cleanliness = getState('Cleanliness') || 80;
const age = getState('Age') || 5;
const lastActivity = getState('LastActivity') || 'sleeping';

const container = document.createElement('div');
container.style.cssText = \`
    background: linear-gradient(135deg, #74b9ff 0%, #0984e3 50%, #6c5ce7 100%);
    border-radius: 20px;
    padding: 25px;
    color: white;
    box-shadow: 0 15px 35px rgba(0,0,0,0.2);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 350px;
    margin: 10px 0;
\`;

function createStatBar(label, value, emoji, color, isInverted = false) {
    const percentage = Math.min(100, Math.max(0, value));
    const displayValue = isInverted ? 100 - percentage : percentage;
    return \`
        <div style="margin: 10px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-weight: 600;">\${emoji} \${label}</span>
                <span style="font-weight: bold; color: \${getStatColor(displayValue)};">\${percentage}/100</span>
            </div>
            <div style="background: rgba(0,0,0,0.25); border-radius: 10px; padding: 3px;">
                <div style="
                    background: linear-gradient(90deg, \${color}44, \${color});
                    height: 8px;
                    border-radius: 8px;
                    width: \${displayValue}%;
                    transition: all 0.6s ease;
                    box-shadow: 0 2px 6px \${color}44;
                "></div>
            </div>
        </div>
    \`;
}

function getStatColor(value) {
    if (value >= 70) return '#2ed573';
    if (value >= 40) return '#ffa502';
    return '#ff4757';
}

function getPetMood() {
    const average = (happiness + (100 - hunger) + energy + health + cleanliness) / 5;
    if (average >= 80) return { emoji: '😊', mood: 'Very Happy' };
    if (average >= 60) return { emoji: '😌', mood: 'Content' };
    if (average >= 40) return { emoji: '😐', mood: 'Okay' };
    if (average >= 20) return { emoji: '😟', mood: 'Unhappy' };
    return { emoji: '😢', mood: 'Very Sad' };
}

const petMood = getPetMood();

container.innerHTML = \`
    <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 48px; margin-bottom: 8px; animation: bounce 2s infinite;">🐾</div>
        <h3 style="margin: 0; font-size: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Pet Care Simulator</h3>
        <div style="margin: 8px 0; padding: 8px 16px; background: rgba(255,255,255,0.2); border-radius: 15px; display: inline-block;">
            <span style="font-size: 20px; margin-right: 8px;">\${petMood.emoji}</span>
            <span style="font-weight: 600;">\${petMood.mood}</span>
        </div>
        <div style="font-size: 14px; opacity: 0.9;">\${age} days old • Last: \${lastActivity}</div>
    </div>

    \${createStatBar('Happiness', happiness, '😊', '#2ed573')}
    \${createStatBar('Hunger', hunger, '🍽️', '#ff6b6b', true)}
    \${createStatBar('Energy', energy, '⚡', '#ffa726')}
    \${createStatBar('Health', health, '❤️', '#e74c3c')}
    \${createStatBar('Cleanliness', cleanliness, '🛁', '#42a5f5')}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
        <button onclick="
            updateState({Hunger: Math.max(0, hunger - 25), Happiness: '+5', LastActivity: 'eating'});
            injectPrompt('I fed my pet some delicious food. They seem satisfied and happy!');
        " style="
            background: rgba(255, 107, 107, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🍖 Feed</button>

        <button onclick="
            updateState({Happiness: '+15', Energy: '-12', LastActivity: 'playing'});
            injectPrompt('I played with my pet! We had so much fun together, though they are a bit tired now.');
        " style="
            background: rgba(46, 213, 115, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🎾 Play</button>

        <button onclick="
            updateState({Energy: Math.min(100, energy + 40), Health: '+3', LastActivity: 'sleeping'});
            injectPrompt('My pet took a nice long nap and is feeling refreshed and energized.');
        " style="
            background: rgba(116, 185, 255, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">💤 Rest</button>

        <button onclick="
            updateState({Cleanliness: Math.min(100, cleanliness + 50), Happiness: '+8', LastActivity: 'bathing'});
            injectPrompt('I gave my pet a nice bath. They are clean and sparkling now!');
        " style="
            background: rgba(108, 92, 231, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🛁 Bathe</button>
    </div>

    <style>
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
        }
    </style>
\`;

root.appendChild(container);`
    },

    /**
     * 4. Space Explorer
     */
    spaceExplorer: {
        id: "space-explorer",
        metadata: {
            name: "space-explorer",
            displayName: "🚀 Space Explorer",
            version: "1.0.0",
            description: "Explore the galaxy, discover planets, and manage spaceship resources",
            author: "Ember Team",
            tags: ["space", "exploration", "sci-fi", "adventure"]
        },
        stateSchema: {
            variables: {
                Fuel: {
                    type: "number",
                    default: 75,
                    min: 0,
                    max: 100,
                    description: "Spaceship fuel level"
                },
                OxygenLevel: {
                    type: "number",
                    default: 90,
                    min: 0,
                    max: 100,
                    description: "Life support oxygen level"
                },
                Credits: {
                    type: "number",
                    default: 500,
                    min: 0,
                    description: "Space credits for trading"
                },
                PlanetsVisited: {
                    type: "array",
                    default: ["Earth", "Mars"],
                    description: "Planets discovered and visited"
                },
                Discoveries: {
                    type: "array",
                    default: ["Water on Mars", "Ancient Ruins"],
                    description: "Scientific discoveries made"
                },
                ShipUpgrades: {
                    type: "array",
                    default: ["Basic Scanner", "Emergency Kit"],
                    description: "Installed ship upgrades"
                },
                CurrentLocation: {
                    type: "string",
                    default: "Mars Orbit",
                    description: "Current ship location"
                },
                TotalDistance: {
                    type: "number",
                    default: 1250,
                    min: 0,
                    description: "Total distance traveled in light-years"
                }
            }
        },
        chatInjection: {
            template: `Space Explorer Status:
Ship Location: {{CurrentLocation}}
- Fuel: {{Fuel}}/100 ⛽
- Oxygen: {{OxygenLevel}}/100 💨
- Credits: {{Credits}} 💰
- Distance Traveled: {{TotalDistance}} light-years
- Planets Visited: {{PlanetsVisited}} ({{PlanetsVisited.length}} total)
- Discoveries: {{Discoveries}} ({{Discoveries.length}} total)
- Ship Upgrades: {{ShipUpgrades}}

[Update exploration progress using STATE_UPDATE format when discovering planets, making scientific breakthroughs, or managing ship resources]`,
            stateUpdateFormat: "[STATE_UPDATE]....[/STATE_UPDATE]",
            instructions: "Track space exploration realistically: traveling consumes fuel (-10 to -30), discoveries add to arrays, trading affects credits, oxygen slowly depletes during long journeys (-2 to -5). Add new planets and discoveries based on exploration events."
        },
        positioning: { type: "left" },
        content: `
const fuel = getState('Fuel') || 75;
const oxygen = getState('OxygenLevel') || 90;
const credits = getState('Credits') || 500;
const planets = getState('PlanetsVisited') || [];
const discoveries = getState('Discoveries') || [];
const upgrades = getState('ShipUpgrades') || [];
const location = getState('CurrentLocation') || 'Mars Orbit';
const distance = getState('TotalDistance') || 1250;

const container = document.createElement('div');
container.style.cssText = \`
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 50%, #000000 100%);
    border-radius: 15px;
    padding: 20px;
    color: white;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    font-family: 'Courier New', monospace;
    max-width: 300px;
    border: 1px solid rgba(255,255,255,0.2);
    position: relative;
    overflow: hidden;
\`;

function createResourceBar(label, value, emoji, color) {
    const percentage = Math.min(100, Math.max(0, value));
    const status = percentage > 70 ? 'OPTIMAL' : percentage > 30 ? 'CAUTION' : 'CRITICAL';
    const statusColor = percentage > 70 ? '#2ed573' : percentage > 30 ? '#ffa502' : '#ff4757';

    return \`
        <div style="margin: 8px 0; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 12px; font-weight: bold;">\${emoji} \${label}</span>
                <span style="font-size: 10px; color: \${statusColor}; font-weight: bold;">\${status}</span>
            </div>
            <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 14px; font-weight: bold;">\${percentage}%</span>
            </div>
            <div style="background: rgba(0,0,0,0.5); border-radius: 4px; padding: 1px;">
                <div style="
                    background: linear-gradient(90deg, \${color}, \${color}aa);
                    height: 6px;
                    border-radius: 3px;
                    width: \${percentage}%;
                    transition: width 0.8s ease;
                    box-shadow: 0 0 8px \${color}66;
                "></div>
            </div>
        </div>
    \`;
}

container.innerHTML = \`
    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px); background-size: 20px 20px; opacity: 0.3; pointer-events: none;"></div>

    <div style="text-align: center; margin-bottom: 15px; position: relative; z-index: 1;">
        <div style="font-size: 24px; margin-bottom: 5px;">🚀</div>
        <h3 style="margin: 0; font-size: 16px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">SPACE EXPLORER</h3>
        <div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">LOCATION: \${location.toUpperCase()}</div>
    </div>

    <div style="position: relative; z-index: 1;">
        \${createResourceBar('FUEL', fuel, '⛽', '#3498db')}
        \${createResourceBar('OXYGEN', oxygen, '💨', '#2ecc71')}

        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px; margin: 8px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; font-weight: bold;">💰 CREDITS</span>
                <span style="font-size: 14px; font-weight: bold; color: #f1c40f;">\${credits.toLocaleString()}</span>
            </div>
        </div>

        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px; margin: 8px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; font-weight: bold;">📏 DISTANCE</span>
                <span style="font-size: 12px; font-weight: bold; color: #9b59b6;">\${distance.toLocaleString()} LY</span>
            </div>
        </div>

        <div style="font-size: 11px; margin: 12px 0;">
            <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px; margin: 4px 0;">
                <div style="font-weight: bold; margin-bottom: 4px;">🪐 PLANETS (\${planets.length})</div>
                <div style="max-height: 50px; overflow-y: auto;">
                    \${planets.length > 0
                        ? planets.slice(-3).map(planet => \`<div style="opacity: 0.9;">• \${planet}</div>\`).join('')
                        : '<div style="opacity: 0.6;">No planets discovered</div>'
                    }
                    \${planets.length > 3 ? \`<div style="opacity: 0.6;">... and \${planets.length - 3} more</div>\` : ''}
                </div>
            </div>

            <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 6px; margin: 4px 0;">
                <div style="font-weight: bold; margin-bottom: 4px;">🔬 DISCOVERIES (\${discoveries.length})</div>
                <div style="max-height: 50px; overflow-y: auto;">
                    \${discoveries.length > 0
                        ? discoveries.slice(-2).map(discovery => \`<div style="opacity: 0.9;">• \${discovery}</div>\`).join('')
                        : '<div style="opacity: 0.6;">No discoveries yet</div>'
                    }
                    \${discoveries.length > 2 ? \`<div style="opacity: 0.6;">... and \${discoveries.length - 2} more</div>\` : ''}
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 12px;">
            <button onclick="
                updateState({Fuel: '-15', TotalDistance: '+50', CurrentLocation: 'Deep Space'});
                injectPrompt('I engaged the hyperdrive and traveled to a new star system, using fuel but covering great distance.');
            " style="
                background: rgba(52, 152, 219, 0.8);
                border: none;
                color: white;
                padding: 8px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
            ">🌌 EXPLORE</button>

            <button onclick="
                updateState({Credits: '+100', Fuel: Math.min(100, fuel + 30)});
                injectPrompt('I docked at a space station to refuel and trade resources, spending credits for fuel.');
            " style="
                background: rgba(241, 196, 15, 0.8);
                border: none;
                color: white;
                padding: 8px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
            ">⛽ REFUEL</button>

            <button onclick="
                updateState({Discoveries: '+Alien Artifact', Credits: '+200'});
                injectPrompt('I conducted a detailed scan of the area and discovered something valuable!');
            " style="
                background: rgba(155, 89, 182, 0.8);
                border: none;
                color: white;
                padding: 8px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
            ">🔍 SCAN</button>

            <button onclick="
                updateState({OxygenLevel: Math.min(100, oxygen + 25), Fuel: '-5'});
                injectPrompt('I activated the life support systems to replenish oxygen reserves.');
            " style="
                background: rgba(46, 204, 113, 0.8);
                border: none;
                color: white;
                padding: 8px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
            ">💨 O2 SYS</button>
        </div>
    </div>
\`;

root.appendChild(container);`
    },

    /**
     * 5. Cooking Challenge
     */
    cookingChallenge: {
        id: "cooking-challenge",
        metadata: {
            name: "cooking-challenge",
            displayName: "👨‍🍳 Cooking Challenge",
            version: "1.0.0",
            description: "Master culinary skills, collect recipes, and compete in cooking challenges",
            author: "Ember Team",
            tags: ["cooking", "recipes", "skill", "food"]
        },
        stateSchema: {
            variables: {
                CookingSkill: {
                    type: "number",
                    default: 25,
                    min: 0,
                    max: 100,
                    description: "Overall cooking proficiency"
                },
                KnownRecipes: {
                    type: "array",
                    default: ["Scrambled Eggs", "Pasta", "Grilled Cheese"],
                    description: "Recipes learned"
                },
                Ingredients: {
                    type: "array",
                    default: ["Eggs", "Flour", "Cheese", "Tomatoes", "Onions"],
                    description: "Available ingredients"
                },
                CompletedDishes: {
                    type: "number",
                    default: 8,
                    min: 0,
                    description: "Total dishes successfully prepared"
                },
                ChallengeWins: {
                    type: "number",
                    default: 2,
                    min: 0,
                    description: "Cooking challenges won"
                },
                Specialties: {
                    type: "array",
                    default: ["Italian"],
                    description: "Cuisine specialties mastered"
                },
                CurrentChallenge: {
                    type: "string",
                    default: "none",
                    description: "Active cooking challenge"
                }
            }
        },
        chatInjection: {
            template: `Cooking Profile:
- Skill Level: {{CookingSkill}}/100 👨‍🍳
- Known Recipes: {{KnownRecipes}} ({{KnownRecipes.length}} total)
- Available Ingredients: {{Ingredients}}
- Completed Dishes: {{CompletedDishes}}
- Challenge Wins: {{ChallengeWins}}
- Specialties: {{Specialties}}
- Current Challenge: {{CurrentChallenge}}

[Update cooking progress using STATE_UPDATE format when learning recipes, completing dishes, or participating in challenges]`,
            stateUpdateFormat: "[STATE_UPDATE]....[/STATE_UPDATE]",
            instructions: "Track culinary progress: successful cooking increases skill (+3 to +8), learning new recipes adds to KnownRecipes array, completing dishes increments CompletedDishes, winning challenges increases ChallengeWins. Add specialties when mastering cuisine types."
        },
        positioning: { type: "end" },
        content: `
const skill = getState('CookingSkill') || 25;
const recipes = getState('KnownRecipes') || [];
const ingredients = getState('Ingredients') || [];
const completed = getState('CompletedDishes') || 8;
const wins = getState('ChallengeWins') || 2;
const specialties = getState('Specialties') || [];
const challenge = getState('CurrentChallenge') || 'none';

const container = document.createElement('div');
container.style.cssText = \`
    background: linear-gradient(135deg, #fd79a8 0%, #e84393 50%, #a29bfe 100%);
    border-radius: 20px;
    padding: 25px;
    color: white;
    box-shadow: 0 15px 35px rgba(0,0,0,0.2);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 380px;
    margin: 10px 0;
\`;

function getSkillLevel(skill) {
    if (skill >= 90) return { level: 'Master Chef', emoji: '🏆', color: '#f39c12' };
    if (skill >= 70) return { level: 'Expert Cook', emoji: '👨‍🍳', color: '#e74c3c' };
    if (skill >= 50) return { level: 'Good Cook', emoji: '🍳', color: '#3498db' };
    if (skill >= 30) return { level: 'Home Cook', emoji: '🥄', color: '#2ecc71' };
    return { level: 'Beginner', emoji: '📚', color: '#95a5a6' };
}

const skillInfo = getSkillLevel(skill);

container.innerHTML = \`
    <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 40px; margin-bottom: 8px;">👨‍🍳</div>
        <h3 style="margin: 0; font-size: 22px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Cooking Challenge</h3>
        <div style="margin: 8px 0; padding: 8px 16px; background: rgba(255,255,255,0.2); border-radius: 15px; display: inline-block;">
            <span style="font-size: 18px; margin-right: 6px;">\${skillInfo.emoji}</span>
            <span style="font-weight: 600;">\${skillInfo.level}</span>
        </div>
    </div>

    <div style="margin: 15px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 600;">🔥 Cooking Skill</span>
            <span style="font-weight: bold; font-size: 16px;">\${skill}/100</span>
        </div>
        <div style="background: rgba(0,0,0,0.25); border-radius: 12px; padding: 4px;">
            <div style="
                background: linear-gradient(90deg, \${skillInfo.color}44, \${skillInfo.color});
                height: 12px;
                border-radius: 10px;
                width: \${skill}%;
                transition: width 0.8s ease;
                box-shadow: 0 2px 8px \${skillInfo.color}44;
            "></div>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin: 20px 0;">
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 4px;">📝</div>
            <div style="font-size: 11px; opacity: 0.9;">Recipes</div>
            <div style="font-weight: bold; font-size: 16px;">\${recipes.length}</div>
        </div>
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 4px;">🍽️</div>
            <div style="font-size: 11px; opacity: 0.9;">Completed</div>
            <div style="font-weight: bold; font-size: 16px;">\${completed}</div>
        </div>
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 24px; margin-bottom: 4px;">🏆</div>
            <div style="font-size: 11px; opacity: 0.9;">Wins</div>
            <div style="font-weight: bold; font-size: 16px;">\${wins}</div>
        </div>
    </div>

    <div style="margin: 15px 0;">
        <details style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 12px;">
            <summary style="cursor: pointer; font-weight: 600; outline: none;">🥘 Specialties (\${specialties.length})</summary>
            <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
                \${specialties.map(specialty => \`<span style="background: rgba(243, 156, 18, 0.3); padding: 4px 10px; border-radius: 15px; font-size: 12px; border: 1px solid rgba(243, 156, 18, 0.5);">\${specialty}</span>\`).join('')}
                \${specialties.length === 0 ? '<span style="opacity: 0.7; font-style: italic;">No specialties yet</span>' : ''}
            </div>
        </details>
    </div>

    <div style="margin: 15px 0;">
        <details style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 12px;">
            <summary style="cursor: pointer; font-weight: 600; outline: none;">🥬 Ingredients (\${ingredients.length})</summary>
            <div style="margin-top: 8px; max-height: 80px; overflow-y: auto;">
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    \${ingredients.map(ingredient => \`<span style="background: rgba(46, 204, 113, 0.3); padding: 3px 8px; border-radius: 12px; font-size: 11px; border: 1px solid rgba(46, 204, 113, 0.5);">\${ingredient}</span>\`).join('')}
                </div>
            </div>
        </details>
    </div>

    \${challenge !== 'none' ? \`
        <div style="background: rgba(230, 67, 147, 0.3); border: 2px solid rgba(230, 67, 147, 0.6); border-radius: 12px; padding: 12px; margin: 15px 0;">
            <div style="font-weight: bold; margin-bottom: 6px;">🔥 Active Challenge</div>
            <div style="font-size: 14px;">\${challenge}</div>
        </div>
    \` : ''}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
        <button onclick="
            updateState({CookingSkill: '+6', CompletedDishes: '+1', KnownRecipes: '+Beef Stew'});
            injectPrompt('I successfully prepared a new dish and learned a new recipe! My cooking skills improved.');
        " style="
            background: rgba(231, 76, 60, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🍳 Cook Dish</button>

        <button onclick="
            updateState({ChallengeWins: '+1', CookingSkill: '+10', CurrentChallenge: 'none'});
            injectPrompt('I won the cooking challenge! My skills have improved significantly from the competition.');
        " style="
            background: rgba(155, 89, 182, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🏆 Challenge</button>

        <button onclick="
            updateState({Ingredients: '+Fresh Herbs', Ingredients: '+Saffron'});
            injectPrompt('I went shopping and found some high-quality ingredients for my next cooking adventure.');
        " style="
            background: rgba(46, 204, 113, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🛒 Shop</button>

        <button onclick="
            updateState({Specialties: '+French', CookingSkill: '+8'});
            injectPrompt('I studied French cuisine intensively and can now consider it one of my specialties!');
        " style="
            background: rgba(52, 152, 219, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">📚 Study</button>
    </div>
\`;

root.appendChild(container);`
    },

    /**
     * 6. Fitness Tracker
     */
    fitnessTracker: {
        id: "fitness-tracker",
        metadata: {
            name: "fitness-tracker",
            displayName: "💪 Fitness Tracker",
            version: "1.0.0",
            description: "Track workouts, monitor health metrics, and achieve fitness goals",
            author: "Ember Team",
            tags: ["fitness", "health", "exercise", "goals"]
        },
        stateSchema: {
            variables: {
                Strength: {
                    type: "number",
                    default: 40,
                    min: 0,
                    max: 100,
                    description: "Physical strength level"
                },
                Cardio: {
                    type: "number",
                    default: 35,
                    min: 0,
                    max: 100,
                    description: "Cardiovascular endurance"
                },
                Flexibility: {
                    type: "number",
                    default: 30,
                    min: 0,
                    max: 100,
                    description: "Flexibility and mobility"
                },
                WorkoutsCompleted: {
                    type: "number",
                    default: 12,
                    min: 0,
                    description: "Total workouts finished"
                },
                WeightLifted: {
                    type: "number",
                    default: 2500,
                    min: 0,
                    description: "Total weight lifted in pounds"
                },
                CaloriesBurned: {
                    type: "number",
                    default: 1800,
                    min: 0,
                    description: "Total calories burned"
                },
                CurrentGoal: {
                    type: "string",
                    default: "Build muscle mass",
                    description: "Active fitness goal"
                },
                Achievements: {
                    type: "array",
                    default: ["First Workout", "Week Streak"],
                    description: "Fitness achievements unlocked"
                }
            }
        },
        chatInjection: {
            template: `Fitness Profile:
- Strength: {{Strength}}/100 💪
- Cardio: {{Cardio}}/100 ❤️
- Flexibility: {{Flexibility}}/100 🤸
- Workouts Completed: {{WorkoutsCompleted}}
- Weight Lifted: {{WeightLifted}} lbs
- Calories Burned: {{CaloriesBurned}}
- Current Goal: {{CurrentGoal}}
- Achievements: {{Achievements}}

[Update fitness progress using STATE_UPDATE format when completing workouts or reaching milestones]`,
            stateUpdateFormat: "[STATE_UPDATE]....[/STATE_UPDATE]",
            instructions: "Track fitness progress: strength training increases Strength (+2 to +5), cardio workouts boost Cardio (+3 to +7), yoga/stretching improves Flexibility (+2 to +4). Update totals for WorkoutsCompleted, WeightLifted, and CaloriesBurned. Add achievements for milestones."
        },
        positioning: { type: "end" },
        content: `
const strength = getState('Strength') || 40;
const cardio = getState('Cardio') || 35;
const flexibility = getState('Flexibility') || 30;
const workouts = getState('WorkoutsCompleted') || 12;
const weight = getState('WeightLifted') || 2500;
const calories = getState('CaloriesBurned') || 1800;
const goal = getState('CurrentGoal') || 'Build muscle mass';
const achievements = getState('Achievements') || [];

const container = document.createElement('div');
container.style.cssText = \`
    background: linear-gradient(135deg, #00b894 0%, #00cec9 50%, #0984e3 100%);
    border-radius: 20px;
    padding: 25px;
    color: white;
    box-shadow: 0 15px 35px rgba(0,0,0,0.2);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 380px;
    margin: 10px 0;
\`;

function createStatBar(label, value, emoji, color) {
    const percentage = Math.min(100, Math.max(0, value));
    return \`
        <div style="margin: 12px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-weight: 600;">\${emoji} \${label}</span>
                <span style="font-weight: bold; font-size: 14px;">\${percentage}/100</span>
            </div>
            <div style="background: rgba(0,0,0,0.25); border-radius: 12px; padding: 3px;">
                <div style="
                    background: linear-gradient(90deg, \${color}44, \${color});
                    height: 10px;
                    border-radius: 10px;
                    width: \${percentage}%;
                    transition: width 0.8s ease;
                    box-shadow: 0 2px 6px \${color}44;
                "></div>
            </div>
        </div>
    \`;
}

function getFitnessLevel(avg) {
    if (avg >= 80) return { level: 'Elite Athlete', emoji: '🏆' };
    if (avg >= 60) return { level: 'Advanced', emoji: '💪' };
    if (avg >= 40) return { level: 'Intermediate', emoji: '🏃' };
    if (avg >= 20) return { level: 'Beginner', emoji: '🚶' };
    return { level: 'Starting Out', emoji: '🌱' };
}

const avgFitness = Math.round((strength + cardio + flexibility) / 3);
const fitnessLevel = getFitnessLevel(avgFitness);

container.innerHTML = \`
    <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 40px; margin-bottom: 8px;">💪</div>
        <h3 style="margin: 0; font-size: 22px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Fitness Tracker</h3>
        <div style="margin: 8px 0; padding: 8px 16px; background: rgba(255,255,255,0.2); border-radius: 15px; display: inline-block;">
            <span style="font-size: 18px; margin-right: 6px;">\${fitnessLevel.emoji}</span>
            <span style="font-weight: 600;">\${fitnessLevel.level}</span>
        </div>
        <div style="font-size: 14px; opacity: 0.9;">Overall Fitness: \${avgFitness}/100</div>
    </div>

    \${createStatBar('Strength', strength, '💪', '#e74c3c')}
    \${createStatBar('Cardio', cardio, '❤️', '#3498db')}
    \${createStatBar('Flexibility', flexibility, '🤸', '#9b59b6')}

    <div style="margin: 20px 0;">
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 15px;">
            <div style="font-weight: bold; margin-bottom: 8px; color: #f1c40f;">🎯 Current Goal</div>
            <div style="font-size: 14px; font-style: italic;">\${goal}</div>
        </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 20px 0;">
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 4px;">🏋️</div>
            <div style="font-size: 10px; opacity: 0.9;">Workouts</div>
            <div style="font-weight: bold; font-size: 14px;">\${workouts}</div>
        </div>
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 4px;">⚖️</div>
            <div style="font-size: 10px; opacity: 0.9;">Weight (lbs)</div>
            <div style="font-weight: bold; font-size: 14px;">\${weight.toLocaleString()}</div>
        </div>
        <div style="background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 12px; padding: 12px; text-align: center;">
            <div style="font-size: 20px; margin-bottom: 4px;">🔥</div>
            <div style="font-size: 10px; opacity: 0.9;">Calories</div>
            <div style="font-weight: bold; font-size: 14px;">\${calories.toLocaleString()}</div>
        </div>
    </div>

    <div style="margin: 15px 0;">
        <details style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 12px;">
            <summary style="cursor: pointer; font-weight: 600; outline: none;">🏆 Achievements (\${achievements.length})</summary>
            <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
                \${achievements.map(achievement => \`<span style="background: rgba(241, 196, 15, 0.3); padding: 4px 10px; border-radius: 15px; font-size: 12px; border: 1px solid rgba(241, 196, 15, 0.5);">\${achievement}</span>\`).join('')}
                \${achievements.length === 0 ? '<span style="opacity: 0.7; font-style: italic;">No achievements yet</span>' : ''}
            </div>
        </details>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
        <button onclick="
            updateState({Strength: '+4', WeightLifted: '+150', WorkoutsCompleted: '+1'});
            injectPrompt('I completed an intense strength training session, lifting heavy weights and building muscle.');
        " style="
            background: rgba(231, 76, 60, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🏋️ Strength</button>

        <button onclick="
            updateState({Cardio: '+6', CaloriesBurned: '+300', WorkoutsCompleted: '+1'});
            injectPrompt('I had an amazing cardio workout, really getting my heart rate up and burning calories.');
        " style="
            background: rgba(52, 152, 219, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🏃 Cardio</button>

        <button onclick="
            updateState({Flexibility: '+5', WorkoutsCompleted: '+1'});
            injectPrompt('I did a relaxing yoga session that really improved my flexibility and mobility.');
        " style="
            background: rgba(155, 89, 182, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🧘 Yoga</button>

        <button onclick="
            updateState({CurrentGoal: 'Run a marathon', Achievements: '+Goal Setter'});
            injectPrompt('I set a new fitness goal and am motivated to achieve it!');
        " style="
            background: rgba(0, 184, 148, 0.8);
            border: none;
            color: white;
            padding: 12px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            backdrop-filter: blur(10px);
        ">🎯 New Goal</button>
    </div>
\`;

root.appendChild(container);`
    }
};

// Export function to get all example packs as an array
export function getAllExamplePacks() {
    return Object.values(ExampleAssetPacks);
}