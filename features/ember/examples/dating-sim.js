// Example Asset Pack: Dating Sim
// This demonstrates the full power of Ember 2.0's asset pack system

//@name dating-sim-example
//@display-name Interactive Dating Sim
//@version 1.0.0
//@description Full-featured dating simulation with relationship mechanics
//@author Ember Community

// Asset pack arguments (user-configurable)
//@arg character_name string "Alex"
//@arg starting_relationship string "stranger"
//@arg enable_gifts boolean true
//@arg difficulty_level number 1

// Context fields (visible to AI)
//@context-field relationship_status string Current relationship level
//@context-field trust_points number Trust level (0-100)
//@context-field affection_points number Affection level (0-100)
//@context-field energy_level number Daily energy (0-100)
//@context-field last_activity string Last interaction performed
//@context-field relationship_events array Major relationship milestones

// Exported functions
//@export updateRelationship
//@export giveGift
//@export planDate
//@export heartToHeart

// AI Instructions
//@ai-instructions This dating sim tracks relationship progression. Current status: {relationship_status}, Trust: {trust_points}/100, Affection: {affection_points}/100. Respond accordingly to the relationship level and recent activities. Be more intimate and friendly as trust/affection increase.

// Game state management
const gameState = {
    characterName: getArg('character_name'),
    relationship: getArg('starting_relationship'),
    trust: getContextField('trust_points') || 10,
    affection: getContextField('affection_points') || 5,
    energy: getContextField('energy_level') || 100,
    lastActivity: getContextField('last_activity') || 'none',
    events: getContextField('relationship_events') || [],

    // Internal state
    dailyInteractions: 0,
    unlockedActivities: ['compliment', 'casual_chat'],
    gifts: ['flowers', 'chocolate', 'book', 'jewelry'],

    // Relationship thresholds
    relationships: {
        stranger: { trust: 0, affection: 0 },
        acquaintance: { trust: 20, affection: 15 },
        friend: { trust: 40, affection: 30 },
        close_friend: { trust: 60, affection: 50 },
        romantic_interest: { trust: 75, affection: 70 },
        dating: { trust: 85, affection: 85 },
        committed: { trust: 95, affection: 95 }
    }
};

// Initialize UI
function initializeDatingSim() {
    // Main container
    const container = document.createElement('div');
    container.className = 'ember-dating-sim';
    container.style.cssText = `
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fecfef 100%);
        border-radius: 15px;
        padding: 20px;
        margin: 10px 0;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        color: #2c3e50;
        max-width: 600px;
    `;

    // Header
    const header = document.createElement('div');
    header.innerHTML = `
        <h2 style="margin: 0 0 15px 0; text-align: center; color: #2c3e50; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            💕 ${gameState.characterName} - Dating Sim 💕
        </h2>
    `;
    container.appendChild(header);

    // Status display
    const statusDiv = createStatusDisplay();
    container.appendChild(statusDiv);

    // Relationship progress
    const progressDiv = createProgressDisplay();
    container.appendChild(progressDiv);

    // Action buttons
    const actionsDiv = createActionButtons();
    container.appendChild(actionsDiv);

    // Recent events
    const eventsDiv = createEventsDisplay();
    container.appendChild(eventsDiv);

    root.appendChild(container);

    // Update context immediately
    updateAllContextFields();
}

function createStatusDisplay() {
    const statusDiv = document.createElement('div');
    statusDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 15px 0;">
            <div class="stat-card" style="background: rgba(255,255,255,0.3); padding: 12px; border-radius: 10px; text-align: center; backdrop-filter: blur(10px);">
                <div style="font-size: 1.5em; margin-bottom: 5px;">❤️</div>
                <div style="font-weight: bold; font-size: 0.9em;">Relationship</div>
                <div style="font-size: 0.8em; color: #555;">${formatRelationship(gameState.relationship)}</div>
            </div>
            <div class="stat-card" style="background: rgba(255,255,255,0.3); padding: 12px; border-radius: 10px; text-align: center; backdrop-filter: blur(10px);">
                <div style="font-size: 1.5em; margin-bottom: 5px;">🤝</div>
                <div style="font-weight: bold; font-size: 0.9em;">Trust</div>
                <div style="font-size: 0.8em; color: #555;">${gameState.trust}/100</div>
            </div>
            <div class="stat-card" style="background: rgba(255,255,255,0.3); padding: 12px; border-radius: 10px; text-align: center; backdrop-filter: blur(10px);">
                <div style="font-size: 1.5em; margin-bottom: 5px;">💖</div>
                <div style="font-weight: bold; font-size: 0.9em;">Affection</div>
                <div style="font-size: 0.8em; color: #555;">${gameState.affection}/100</div>
            </div>
            <div class="stat-card" style="background: rgba(255,255,255,0.3); padding: 12px; border-radius: 10px; text-align: center; backdrop-filter: blur(10px);">
                <div style="font-size: 1.5em; margin-bottom: 5px;">⚡</div>
                <div style="font-weight: bold; font-size: 0.9em;">Energy</div>
                <div style="font-size: 0.8em; color: #555;">${gameState.energy}/100</div>
            </div>
        </div>
    `;
    return statusDiv;
}

function createProgressDisplay() {
    const currentLevel = gameState.relationship;
    const levels = Object.keys(gameState.relationships);
    const currentIndex = levels.indexOf(currentLevel);
    const nextLevel = levels[currentIndex + 1];

    const progressDiv = document.createElement('div');

    if (nextLevel) {
        const nextReqs = gameState.relationships[nextLevel];
        const trustProgress = Math.min(100, (gameState.trust / nextReqs.trust) * 100);
        const affectionProgress = Math.min(100, (gameState.affection / nextReqs.affection) * 100);

        progressDiv.innerHTML = `
            <div style="background: rgba(255,255,255,0.4); padding: 15px; border-radius: 10px; margin: 15px 0; backdrop-filter: blur(10px);">
                <h4 style="margin: 0 0 10px 0; text-align: center;">Progress to ${formatRelationship(nextLevel)}</h4>
                <div style="margin: 8px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-size: 0.9em;">🤝 Trust</span>
                        <span style="font-size: 0.8em;">${gameState.trust}/${nextReqs.trust}</span>
                    </div>
                    <div style="background: rgba(0,0,0,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, #4facfe 0%, #00f2fe 100%); height: 100%; width: ${trustProgress}%; transition: width 0.5s ease;"></div>
                    </div>
                </div>
                <div style="margin: 8px 0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-size: 0.9em;">💖 Affection</span>
                        <span style="font-size: 0.8em;">${gameState.affection}/${nextReqs.affection}</span>
                    </div>
                    <div style="background: rgba(0,0,0,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, #fa709a 0%, #fee140 100%); height: 100%; width: ${affectionProgress}%; transition: width 0.5s ease;"></div>
                    </div>
                </div>
            </div>
        `;
    } else {
        progressDiv.innerHTML = `
            <div style="background: rgba(255,215,0,0.3); padding: 15px; border-radius: 10px; margin: 15px 0; text-align: center; backdrop-filter: blur(10px);">
                <h4 style="margin: 0; color: #b8860b;">🎉 Maximum Relationship Level Achieved! 🎉</h4>
            </div>
        `;
    }

    return progressDiv;
}

function createActionButtons() {
    const actionsDiv = document.createElement('div');
    actionsDiv.innerHTML = `
        <div style="background: rgba(255,255,255,0.4); padding: 15px; border-radius: 10px; margin: 15px 0; backdrop-filter: blur(10px);">
            <h4 style="margin: 0 0 15px 0; text-align: center;">Available Actions</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                ${createActionButton('compliment', '💬 Compliment', 'Give a genuine compliment', 10, 5, 5)}
                ${createActionButton('casual_chat', '☕ Casual Chat', 'Have a friendly conversation', 5, 3, 8)}
                ${gameState.trust >= 20 ? createActionButton('deep_talk', '🗣️ Deep Talk', 'Share something personal', 15, 12, 15) : ''}
                ${gameState.affection >= 25 && getArg('enable_gifts') ? createActionButton('give_gift', '🎁 Give Gift', 'Present a thoughtful gift', 20, 15, 20) : ''}
                ${gameState.trust >= 40 ? createActionButton('plan_date', '🌟 Plan Date', 'Suggest spending time together', 25, 20, 25) : ''}
                ${gameState.trust >= 60 && gameState.affection >= 50 ? createActionButton('heart_to_heart', '💕 Heart-to-Heart', 'Express deeper feelings', 30, 25, 30) : ''}
            </div>
            <div style="margin-top: 15px; text-align: center; font-size: 0.8em; color: #666;">
                Daily interactions: ${gameState.dailyInteractions}/5 | Energy: ${gameState.energy}/100
            </div>
        </div>
    `;

    return actionsDiv;
}

function createActionButton(action, label, description, trustGain, affectionGain, energyCost) {
    const disabled = gameState.energy < energyCost || gameState.dailyInteractions >= 5;
    return `
        <button
            onclick="performAction('${action}', ${trustGain}, ${affectionGain}, ${energyCost})"
            ${disabled ? 'disabled' : ''}
            style="
                padding: 12px 8px;
                border: none;
                border-radius: 8px;
                background: ${disabled ? 'rgba(0,0,0,0.1)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'};
                color: ${disabled ? '#999' : 'white'};
                cursor: ${disabled ? 'not-allowed' : 'pointer'};
                font-weight: bold;
                font-size: 0.8em;
                transition: all 0.2s ease;
                min-height: 60px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
            "
            ${!disabled ? `onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.2)'" onmouseout="this.style.transform=''; this.style.boxShadow=''"` : ''}
        >
            <div style="margin-bottom: 4px;">${label}</div>
            <div style="font-size: 0.7em; opacity: 0.9;">${description}</div>
            <div style="font-size: 0.6em; margin-top: 2px;">-${energyCost} energy</div>
        </button>
    `;
}

function createEventsDisplay() {
    const eventsDiv = document.createElement('div');
    const recentEvents = gameState.events.slice(-3).reverse();

    if (recentEvents.length > 0) {
        eventsDiv.innerHTML = `
            <div style="background: rgba(255,255,255,0.4); padding: 15px; border-radius: 10px; margin: 15px 0; backdrop-filter: blur(10px);">
                <h4 style="margin: 0 0 10px 0; text-align: center;">Recent Events</h4>
                ${recentEvents.map(event => `
                    <div style="background: rgba(255,255,255,0.3); padding: 8px 12px; border-radius: 6px; margin: 5px 0; font-size: 0.85em;">
                        ${event}
                    </div>
                `).join('')}
            </div>
        `;
    }

    return eventsDiv;
}

// Action handler
window.performAction = function(action, trustGain, affectionGain, energyCost) {
    if (gameState.energy < energyCost || gameState.dailyInteractions >= 5) {
        ember.inject({
            content: `I tried to ${action.replace('_', ' ')} but I'm too tired or have already interacted too much today.`,
            ephemeral: true
        });
        return;
    }

    // Update stats
    gameState.trust = Math.min(100, gameState.trust + trustGain);
    gameState.affection = Math.min(100, gameState.affection + affectionGain);
    gameState.energy = Math.max(0, gameState.energy - energyCost);
    gameState.dailyInteractions++;
    gameState.lastActivity = action;

    // Check for relationship advancement
    const oldRelationship = gameState.relationship;
    updateRelationshipStatus();

    // Create action message
    const actionMessages = {
        compliment: [
            "I gave a heartfelt compliment",
            "I expressed genuine appreciation",
            "I shared what I admire about them"
        ],
        casual_chat: [
            "We had a pleasant conversation",
            "We chatted about everyday things",
            "We shared some lighthearted moments"
        ],
        deep_talk: [
            "We had a meaningful conversation",
            "I opened up about something personal",
            "We shared deeper thoughts and feelings"
        ],
        give_gift: [
            "I gave a thoughtful gift",
            "I presented something special",
            "I showed my care through a present"
        ],
        plan_date: [
            "I suggested we spend time together",
            "I planned a special activity for us",
            "I arranged something fun to do together"
        ],
        heart_to_heart: [
            "We had an intimate heart-to-heart",
            "I expressed my deeper feelings",
            "We shared our true emotions"
        ]
    };

    const message = actionMessages[action][Math.floor(Math.random() * actionMessages[action].length)];
    let contextMessage = `${message}. Trust: ${gameState.trust}/100, Affection: ${gameState.affection}/100, Energy: ${gameState.energy}/100.`;

    // Add relationship change notification
    if (oldRelationship !== gameState.relationship) {
        const event = `🎉 Relationship advanced from ${formatRelationship(oldRelationship)} to ${formatRelationship(gameState.relationship)}!`;
        gameState.events.push(event);
        contextMessage += ` ${event}`;
    }

    // Update all context fields
    updateAllContextFields();

    // Inject context
    ember.inject({
        content: contextMessage,
        id: `dating_sim_${action}`,
        depth: 0
    });

    // Refresh UI
    refreshUI();
};

// Relationship management
function updateRelationshipStatus() {
    const relationships = Object.entries(gameState.relationships);

    for (let i = relationships.length - 1; i >= 0; i--) {
        const [level, requirements] = relationships[i];
        if (gameState.trust >= requirements.trust && gameState.affection >= requirements.affection) {
            gameState.relationship = level;
            break;
        }
    }
}

function formatRelationship(relationship) {
    return relationship.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Context field management
function updateAllContextFields() {
    ember.setContextField('relationship_status', gameState.relationship);
    ember.setContextField('trust_points', gameState.trust);
    ember.setContextField('affection_points', gameState.affection);
    ember.setContextField('energy_level', gameState.energy);
    ember.setContextField('last_activity', gameState.lastActivity);
    ember.setContextField('relationship_events', gameState.events);
}

// UI refresh
function refreshUI() {
    // Clear and rebuild
    root.innerHTML = '';
    initializeDatingSim();
}

// Exported functions for external use
window.updateRelationship = function(trustChange, affectionChange) {
    gameState.trust = Math.max(0, Math.min(100, gameState.trust + trustChange));
    gameState.affection = Math.max(0, Math.min(100, gameState.affection + affectionChange));
    updateRelationshipStatus();
    updateAllContextFields();
    refreshUI();
};

window.giveGift = function(giftType) {
    const gifts = {
        flowers: { trust: 5, affection: 15, energy: 15 },
        chocolate: { trust: 3, affection: 12, energy: 10 },
        book: { trust: 12, affection: 8, energy: 15 },
        jewelry: { trust: 8, affection: 25, energy: 25 }
    };

    const gift = gifts[giftType] || gifts.flowers;
    performAction('give_gift', gift.trust, gift.affection, gift.energy);
};

window.planDate = function(dateType) {
    const dates = {
        coffee: { trust: 15, affection: 10, energy: 20 },
        dinner: { trust: 20, affection: 18, energy: 30 },
        movie: { trust: 12, affection: 15, energy: 25 },
        walk: { trust: 10, affection: 12, energy: 15 }
    };

    const date = dates[dateType] || dates.coffee;
    performAction('plan_date', date.trust, date.affection, date.energy);
};

window.heartToHeart = function() {
    performAction('heart_to_heart', 30, 25, 30);
};

// Daily reset function (could be called by a timer)
window.resetDaily = function() {
    gameState.energy = 100;
    gameState.dailyInteractions = 0;
    updateAllContextFields();
    refreshUI();

    ember.inject({
        content: "A new day begins! Energy restored and ready for new interactions.",
        id: "dating_sim_daily_reset",
        ephemeral: true
    });
};

// Initialize the dating sim
initializeDatingSim();

// Initial context injection
ember.inject({
    content: `Dating sim initialized! Currently ${formatRelationship(gameState.relationship)} with ${gameState.characterName}. Trust: ${gameState.trust}/100, Affection: ${gameState.affection}/100. Ready for interactions!`,
    id: "dating_sim_init"
});