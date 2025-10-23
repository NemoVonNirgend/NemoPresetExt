// Enhanced Dating Sim Asset Pack Template
// Demonstrates the full asset pack system with AI integration

export function createEnhancedDatingSimPack(options = {}) {
    const {
        packName = 'enhanced-dating-sim',
        displayName = 'Enhanced Dating Sim',
        characterName = 'Alex',
        position = 'end'
    } = options;

    return {
        id: packName,
        metadata: {
            name: packName,
            displayName: displayName,
            version: '2.0.0',
            description: 'Interactive dating simulation with AI state tracking',
            author: 'Ember Team',
            tags: ['dating', 'relationship', 'interactive', 'stats']
        },

        // State schema defines the variables that persist across the conversation
        stateSchema: {
            variables: {
                VarAffection: {
                    type: 'number',
                    default: 50,
                    min: 0,
                    max: 100,
                    description: 'Romantic affection level'
                },
                VarTrust: {
                    type: 'number',
                    default: 30,
                    min: 0,
                    max: 100,
                    description: 'Trust level'
                },
                VarDesire: {
                    type: 'number',
                    default: 25,
                    min: 0,
                    max: 100,
                    description: 'Desire/attraction level'
                },
                LikeArray: {
                    type: 'array',
                    default: ['coffee', 'books'],
                    description: 'Things the character likes'
                },
                DislikeArray: {
                    type: 'array',
                    default: ['spiders', 'loud noises'],
                    description: 'Things the character dislikes'
                },
                RelationshipStatus: {
                    type: 'string',
                    default: 'acquaintance',
                    description: 'Current relationship status'
                },
                LastInteraction: {
                    type: 'string',
                    default: '',
                    description: 'Last significant interaction'
                }
            }
        },

        // AI integration configuration
        chatInjection: {
            template: `Current Relationship with ${characterName}:
- Affection: {{VarAffection}}/100 ❤️
- Trust: {{VarTrust}}/100 🤝
- Desire: {{VarDesire}}/100 🔥
- Status: {{RelationshipStatus}}
- Known Likes: {{LikeArray}}
- Known Dislikes: {{DislikeArray}}
- Last Interaction: {{LastInteraction}}

[IMPORTANT: At the end of your response, include state changes using this exact format:]
[STATE_UPDATE]
VarAffection: +5 (if affection increased by 5, use +/- for relative changes)
VarTrust: -2 (if trust decreased by 2)
VarDesire: +3 (if desire increased by 3)
LikeArray: +chocolate (if discovered they like chocolate, use + to add items)
DislikeArray: +crowds (if discovered they dislike crowds)
RelationshipStatus: dating (if relationship status changed to dating)
LastInteraction: deep_conversation (describe the type of interaction)
[/STATE_UPDATE]`,

            stateUpdateFormat: '[STATE_UPDATE]....[/STATE_UPDATE]',

            instructions: `You are roleplaying ${characterName}. Pay attention to the relationship stats and respond consistently with the current affection, trust, and desire levels. When interactions would logically change these stats, include the appropriate state updates. Higher affection makes responses warmer, higher trust allows deeper conversations, higher desire adds romantic tension.`
        },

        // Positioning configuration
        positioning: {
            type: position,
            moveable: position === 'moveable',
            sticky: position === 'sticky'
        },

        // The interactive UI code
        content: `
// Enhanced Dating Sim UI
const state = {
    affection: getState('VarAffection') || 50,
    trust: getState('VarTrust') || 30,
    desire: getState('VarDesire') || 25,
    likes: getState('LikeArray') || [],
    dislikes: getState('DislikeArray') || [],
    status: getState('RelationshipStatus') || 'acquaintance',
    lastInteraction: getState('LastInteraction') || ''
};

// Create main container
const container = document.createElement('div');
container.className = 'dating-sim-enhanced';
container.style.cssText = \`
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 15px;
    padding: 20px;
    color: white;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    max-width: 100%;
    overflow: hidden;
    position: relative;
\`;

// Header
const header = document.createElement('div');
header.innerHTML = \`
    <div style="display: flex; align-items: center; margin-bottom: 20px;">
        <div style="font-size: 24px; margin-right: 10px;">💕</div>
        <h2 style="margin: 0; font-size: 20px;">${characterName} - Relationship Tracker</h2>
        <div style="margin-left: auto; font-size: 14px; opacity: 0.8;">
            Status: \${state.status}
        </div>
    </div>
\`;
container.appendChild(header);

// Stats display with animated bars
const statsContainer = document.createElement('div');
statsContainer.style.cssText = \`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 15px;
    margin-bottom: 20px;
\`;

function createStatBar(label, value, icon, color) {
    const statDiv = document.createElement('div');
    statDiv.style.cssText = \`
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 12px;
        text-align: center;
        backdrop-filter: blur(10px);
    \`;

    statDiv.innerHTML = \`
        <div style="font-size: 18px; margin-bottom: 5px;">\${icon}</div>
        <div style="font-weight: bold; margin-bottom: 8px;">\${label}</div>
        <div style="background: rgba(0,0,0,0.2); border-radius: 10px; padding: 3px; margin-bottom: 5px;">
            <div style="background: \${color}; height: 8px; border-radius: 10px; width: \${value}%; transition: width 0.5s ease;"></div>
        </div>
        <div style="font-size: 14px; font-weight: bold;">\${value}/100</div>
    \`;

    return statDiv;
}

statsContainer.appendChild(createStatBar('Affection', state.affection, '❤️', '#ff4757'));
statsContainer.appendChild(createStatBar('Trust', state.trust, '🤝', '#2ed573'));
statsContainer.appendChild(createStatBar('Desire', state.desire, '🔥', '#ff6b81'));
container.appendChild(statsContainer);

// Likes/Dislikes section
const preferencesDiv = document.createElement('div');
preferencesDiv.style.cssText = \`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin-bottom: 20px;
\`;

function createPreferenceList(title, items, icon, isLikes = true) {
    const div = document.createElement('div');
    div.style.cssText = \`
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 12px;
        backdrop-filter: blur(10px);
    \`;

    const itemsHtml = items.length > 0
        ? items.map(item => \`<span style="background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 15px; margin: 2px; display: inline-block; font-size: 12px;">\${item}</span>\`).join('')
        : '<span style="opacity: 0.6; font-style: italic;">None discovered yet</span>';

    div.innerHTML = \`
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 16px; margin-right: 8px;">\${icon}</span>
            <strong>\${title}</strong>
        </div>
        <div>\${itemsHtml}</div>
    \`;

    return div;
}

preferencesDiv.appendChild(createPreferenceList('Likes', state.likes, '👍', true));
preferencesDiv.appendChild(createPreferenceList('Dislikes', state.dislikes, '👎', false));
container.appendChild(preferencesDiv);

// Last interaction
if (state.lastInteraction) {
    const lastInteractionDiv = document.createElement('div');
    lastInteractionDiv.style.cssText = \`
        background: rgba(255,255,255,0.1);
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 20px;
        backdrop-filter: blur(10px);
    \`;
    lastInteractionDiv.innerHTML = \`
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
            <span style="font-size: 16px; margin-right: 8px;">💭</span>
            <strong>Last Interaction</strong>
        </div>
        <div style="font-style: italic; opacity: 0.9;">\${state.lastInteraction.replace(/_/g, ' ')}</div>
    \`;
    container.appendChild(lastInteractionDiv);
}

// Action buttons
const actionsDiv = document.createElement('div');
actionsDiv.style.cssText = \`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 15px;
\`;

function createActionButton(text, emoji, action, condition = true) {
    const button = document.createElement('button');
    button.style.cssText = \`
        background: rgba(255,255,255,0.15);
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 10px;
        color: white;
        padding: 12px;
        cursor: \${condition ? 'pointer' : 'not-allowed'};
        transition: all 0.3s ease;
        font-weight: bold;
        opacity: \${condition ? '1' : '0.5'};
        backdrop-filter: blur(10px);
    \`;

    button.innerHTML = \`\${emoji} \${text}\`;

    if (condition) {
        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(255,255,255,0.25)';
            button.style.transform = 'translateY(-2px)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = 'rgba(255,255,255,0.15)';
            button.style.transform = 'translateY(0)';
        });

        button.addEventListener('click', action);
    }

    return button;
}

// Action button functions
function compliment() {
    updateState({
        VarAffection: '+5',
        LastInteraction: 'compliment'
    });

    injectPrompt(\`I gave \${characterName} a sincere compliment. This should increase affection.\`);
    showNotification('💕 Gave a compliment (+5 Affection)');
}

function giveGift() {
    updateState({
        VarAffection: '+8',
        VarTrust: '+3',
        LastInteraction: 'gift'
    });

    injectPrompt(\`I gave \${characterName} a thoughtful gift. This should increase both affection and trust.\`);
    showNotification('🎁 Gave a gift (+8 Affection, +3 Trust)');
}

function askOnDate() {
    if (state.affection >= 40) {
        updateState({
            VarAffection: '+12',
            VarTrust: '+8',
            VarDesire: '+5',
            LastInteraction: 'date'
        });

        if (state.affection + 12 >= 70 && state.trust + 8 >= 60) {
            updateState({ RelationshipStatus: 'dating' });
        }

        injectPrompt(\`I asked \${characterName} on a date and they accepted! This was a significant step in our relationship.\`);
        showNotification('💖 Date accepted! (+12 Affection, +8 Trust, +5 Desire)');
    } else {
        injectPrompt(\`I asked \${characterName} on a date, but they politely declined. I need to build more affection first.\`);
        showNotification('💔 Date declined - need more affection first');
    }
}

function heartToHeart() {
    if (state.trust >= 50) {
        updateState({
            VarTrust: '+15',
            VarAffection: '+6',
            LastInteraction: 'deep_conversation'
        });

        if (state.trust + 15 >= 80 && state.affection + 6 >= 70) {
            updateState({ RelationshipStatus: 'close_friends' });
        }

        injectPrompt(\`\${characterName} and I had a deep, meaningful conversation. We shared personal thoughts and feelings.\`);
        showNotification('💭 Deep conversation (+15 Trust, +6 Affection)');
    } else {
        injectPrompt(\`I tried to have a deeper conversation with \${characterName}, but they weren't ready to open up yet. I need to build more trust first.\`);
        showNotification('🤐 Not ready for deep conversation - need more trust');
    }
}

// Create action buttons
actionsDiv.appendChild(createActionButton('Compliment', '💕', compliment));
actionsDiv.appendChild(createActionButton('Give Gift', '🎁', giveGift));
actionsDiv.appendChild(createActionButton('Ask on Date', '💖', askOnDate, state.affection >= 40));
actionsDiv.appendChild(createActionButton('Heart-to-Heart', '💭', heartToHeart, state.trust >= 50));

container.appendChild(actionsDiv);

// Progress indicators
const progressDiv = document.createElement('div');
progressDiv.style.cssText = \`
    background: rgba(255,255,255,0.1);
    border-radius: 10px;
    padding: 12px;
    backdrop-filter: blur(10px);
    font-size: 12px;
\`;

function getRelationshipGoals() {
    const goals = [];

    if (state.affection < 70) goals.push(\`❤️ \${70 - state.affection} affection needed for dating\`);
    if (state.trust < 60) goals.push(\`🤝 \${60 - state.trust} trust needed for dating\`);
    if (state.affection >= 70 && state.trust >= 60 && state.status !== 'dating') {
        goals.push('💖 Ready to become dating partners!');
    }
    if (state.trust < 80) goals.push(\`🤝 \${80 - state.trust} trust needed for close friendship\`);

    return goals.length > 0 ? goals : ['🎉 All relationship milestones achieved!'];
}

progressDiv.innerHTML = \`
    <div style="font-weight: bold; margin-bottom: 8px;">Relationship Goals:</div>
    \${getRelationshipGoals().map(goal => \`<div style="margin: 4px 0;">• \${goal}</div>\`).join('')}
\`;

container.appendChild(progressDiv);

// Notification system
function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = \`
        position: absolute;
        top: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
    \`;

    notification.textContent = message;
    container.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = \`
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
\`;
document.head.appendChild(style);

// Listen for state changes to update UI
on('stateChanged', (data) => {
    log('State changed:', data);

    // Update local state
    if (data.varName.startsWith('Var')) {
        const stateName = data.varName.replace('Var', '').toLowerCase();
        if (state[stateName] !== undefined) {
            state[stateName] = data.newValue;
        }
    } else if (data.varName.includes('Array')) {
        const arrayName = data.varName.replace('Array', '').toLowerCase() + 's';
        if (state[arrayName] !== undefined) {
            state[arrayName] = data.newValue;
        }
    } else {
        const stateName = data.varName.toLowerCase();
        if (state[stateName] !== undefined) {
            state[stateName] = data.newValue;
        }
    }

    // Could refresh UI here if needed
    // For now, changes will be visible on next render
});

// Inject current state into AI context
const currentPrompt = getCurrentPrompt();
if (currentPrompt) {
    injectPrompt(currentPrompt);
}

// Add to DOM
root.appendChild(container);

log('Enhanced Dating Sim initialized with state:', state);
`
    };
}

// Example usage and auto-registration
if (typeof window !== 'undefined' && window.ember) {
    // Auto-register the enhanced dating sim pack
    const pack = createEnhancedDatingSimPack({
        characterName: 'Alex',
        position: 'end'
    });

    window.ember.registerAssetPack(pack);
    console.log('[Enhanced Dating Sim] Pack registered and ready to use!');
    console.log('Usage: Add [ASSET_PACK:enhanced-dating-sim] to any message to activate');
    console.log('Usage: Add [PACK:enhanced-dating-sim:right] to position it on the right side');
}