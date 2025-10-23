// prompt-archive.js
// Functional prompt archive system that interfaces with SillyTavern's prompt management

import { LOG_PREFIX } from '../../core/utils.js';
import { extension_settings } from '../../../../../extensions.js';
import { saveSettingsDebounced } from '../../../../../../script.js';
import { eventSource, event_types } from '../../../../../../script.js';

export const NemoPromptArchive = {
    initialized: false,
    archives: {},
    
    initialize: function() {
        if (this.initialized) return;
        
        // Load existing archives from extension settings
        this.loadArchives();
        
        // Set up event listeners
        this.setupEventListeners();
        
        this.initialized = true;
        console.log(`${LOG_PREFIX} Prompt Archive system initialized`);
    },

    loadArchives: function() {
        const savedArchives = extension_settings.NemoPresetExt?.promptArchives || {};
        this.archives = savedArchives;
        console.log(`${LOG_PREFIX} Loaded ${Object.keys(this.archives).length} prompt archives`);
    },

    saveArchives: function() {
        if (!extension_settings.NemoPresetExt) {
            extension_settings.NemoPresetExt = {};
        }
        extension_settings.NemoPresetExt.promptArchives = this.archives;
        saveSettingsDebounced();
    },

    setupEventListeners: function() {
        // Listen for prompt changes to auto-archive if needed
        eventSource.on(event_types.OAI_PRESET_CHANGED_AFTER, () => {
            // Could implement auto-archiving here
        });
    },

    // Create a new archive from current prompts
    createArchive: function(archiveName, description = '') {
        try {
            const timestamp = new Date().toISOString();
            const archiveId = `${Date.now()}_${archiveName.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            // Get current prompt data
            const promptData = this.getCurrentPrompts();
            const systemPromptData = this.getCurrentSystemPrompts();
            
            const archive = {
                id: archiveId,
                name: archiveName,
                description: description,
                timestamp: timestamp,
                promptData: promptData,
                systemPromptData: systemPromptData,
                metadata: {
                    totalPrompts: promptData.prompts ? promptData.prompts.length : 0,
                    totalSystemPrompts: systemPromptData.length,
                    createdBy: 'NemoPresetExt',
                    version: '1.0'
                }
            };
            
            this.archives[archiveId] = archive;
            this.saveArchives();
            
            console.log(`${LOG_PREFIX} Created archive: ${archiveName} with ${archive.metadata.totalPrompts} prompts and ${archive.metadata.totalSystemPrompts} system prompts`);
            return archiveId;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error creating archive:`, error);
            return null;
        }
    },

    getCurrentPrompts: function() {
        try {
            // Access SillyTavern's prompt data
            if (window.oai_settings && window.oai_settings.prompts) {
                return {
                    prompts: [...window.oai_settings.prompts],
                    prompt_order: window.oai_settings.prompt_order ? {...window.oai_settings.prompt_order} : {}
                };
            }
            return { prompts: [], prompt_order: {} };
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting current prompts:`, error);
            return { prompts: [], prompt_order: {} };
        }
    },

    getCurrentSystemPrompts: function() {
        try {
            // Access SillyTavern's system prompts
            if (window.system_prompts) {
                return [...window.system_prompts];
            }
            return [];
        } catch (error) {
            console.error(`${LOG_PREFIX} Error getting current system prompts:`, error);
            return [];
        }
    },

    // Restore prompts from an archive
    restoreArchive: function(archiveId, options = {}) {
        const archive = this.archives[archiveId];
        if (!archive) {
            console.error(`${LOG_PREFIX} Archive not found: ${archiveId}`);
            return false;
        }

        try {
            const { 
                restorePrompts = true, 
                restoreSystemPrompts = true, 
                mergeMode = false // If true, merge with existing; if false, replace
            } = options;

            if (restorePrompts && archive.promptData) {
                this.restorePrompts(archive.promptData, mergeMode);
            }

            if (restoreSystemPrompts && archive.systemPromptData) {
                this.restoreSystemPrompts(archive.systemPromptData, mergeMode);
            }

            console.log(`${LOG_PREFIX} Restored archive: ${archive.name}`);
            return true;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error restoring archive:`, error);
            return false;
        }
    },

    restorePrompts: function(promptData, mergeMode) {
        if (!window.promptManager) {
            console.error(`${LOG_PREFIX} PromptManager not available`);
            return false;
        }

        try {
            if (!mergeMode) {
                // Replace mode: clear existing user prompts but keep system ones
                this.clearUserPrompts();
                // Also clear prompt order references for user prompts
                this.clearUserPromptOrder();
            }

            let successCount = 0;
            let failCount = 0;

            // Add each archived prompt using the official PromptManager API
            promptData.prompts.forEach(archivedPrompt => {
                try {
                    // Check if prompt already exists (for merge mode)
                    if (mergeMode) {
                        const existingPrompt = window.promptManager.getPromptById(archivedPrompt.identifier);
                        if (existingPrompt) {
                            console.log(`${LOG_PREFIX} Skipping existing prompt: ${archivedPrompt.identifier}`);
                            return;
                        }
                    }

                    // Add prompt to the prompts array
                    window.promptManager.addPrompt(archivedPrompt, archivedPrompt.identifier);
                    
                    // Now add it to the active character's prompt order so it appears in the UI and gets used
                    this.addPromptToActiveOrder(archivedPrompt);
                    
                    successCount++;
                    console.log(`${LOG_PREFIX} Successfully restored prompt to arrays: ${archivedPrompt.name || archivedPrompt.identifier}`);
                    
                } catch (error) {
                    failCount++;
                    console.error(`${LOG_PREFIX} Error restoring individual prompt:`, archivedPrompt.identifier, error);
                }
            });

            // Restore prompt order configurations if available and in replace mode
            if (promptData.prompt_order && !mergeMode && window.promptManager.activeCharacter) {
                try {
                    // Remove current prompt order for the character
                    window.promptManager.removePromptOrderForCharacter(window.promptManager.activeCharacter);
                    // Add the archived prompt order
                    window.promptManager.addPromptOrderForCharacter(window.promptManager.activeCharacter, promptData.prompt_order);
                    console.log(`${LOG_PREFIX} Restored prompt order for character`);
                } catch (error) {
                    console.warn(`${LOG_PREFIX} Error restoring prompt order:`, error);
                }
            }

            // Trigger save and update UI
            saveSettingsDebounced();
            this.refreshPromptUI();
            
            console.log(`${LOG_PREFIX} Prompt restoration completed: ${successCount} successful, ${failCount} failed`);
            return failCount === 0; // Return true if all succeeded
            
        } catch (error) {
            console.error(`${LOG_PREFIX} Error in restorePrompts:`, error);
            return false;
        }
    },
    
    addPromptToActiveOrder: function(prompt) {
        if (!window.promptManager || !window.promptManager.activeCharacter) {
            console.warn(`${LOG_PREFIX} No active character for prompt order`);
            return;
        }
        
        try {
            // Get current prompt order for the active character
            const promptOrder = window.promptManager.getPromptOrderForCharacter(window.promptManager.activeCharacter);
            
            // Check if prompt is already in the order
            const existingIndex = promptOrder.findIndex(entry => entry.identifier === prompt.identifier);
            if (existingIndex !== -1) {
                console.log(`${LOG_PREFIX} Prompt ${prompt.identifier} already in order, updating`);
                // Update the existing entry
                promptOrder[existingIndex] = {
                    identifier: prompt.identifier,
                    enabled: prompt.enabled !== false // Default to enabled unless explicitly disabled
                };
            } else {
                // Add to the prompt order - by default we add at the end
                promptOrder.push({
                    identifier: prompt.identifier,
                    enabled: prompt.enabled !== false // Default to enabled unless explicitly disabled
                });
                console.log(`${LOG_PREFIX} Added prompt ${prompt.identifier} to active character prompt order`);
            }
            
        } catch (error) {
            console.error(`${LOG_PREFIX} Error adding prompt to active order:`, error);
        }
    },
    
    clearUserPromptOrder: function() {
        if (!window.promptManager || !window.promptManager.activeCharacter) {
            return;
        }
        
        try {
            // Get current prompt order
            const promptOrder = window.promptManager.getPromptOrderForCharacter(window.promptManager.activeCharacter);
            
            // Keep only system prompts and essential ones in the order
            const systemPromptIds = window.promptManager.serviceSettings.prompts
                .filter(p => p.system_prompt || p.marker || p.role === 'system')
                .map(p => p.identifier);
            
            // Remove non-system prompts from order
            for (let i = promptOrder.length - 1; i >= 0; i--) {
                if (!systemPromptIds.includes(promptOrder[i].identifier)) {
                    promptOrder.splice(i, 1);
                }
            }
            
            console.log(`${LOG_PREFIX} Cleared user prompts from prompt order, keeping system prompts`);
        } catch (error) {
            console.error(`${LOG_PREFIX} Error clearing user prompt order:`, error);
        }
    },

    clearUserPrompts: function() {
        // Clear user prompts but keep system prompts and essential ones
        if (!window.oai_settings || !window.oai_settings.prompts) return;
        
        // Keep only system prompts and essential prompts
        window.oai_settings.prompts = window.oai_settings.prompts.filter(prompt => {
            return prompt.system_prompt || prompt.marker || prompt.role === 'system';
        });
        
        console.log(`${LOG_PREFIX} Cleared user prompts, keeping system prompts`);
    },

    restoreSystemPrompts: function(systemPromptData, mergeMode) {
        try {
            // Get the system prompt preset manager
            const syspromptManager = window.getPresetManager ? window.getPresetManager('sysprompt') : null;
            
            if (!syspromptManager && !window.system_prompts) {
                console.error(`${LOG_PREFIX} System prompt manager not available`);
                return;
            }

            let successCount = 0;
            let failCount = 0;

            if (mergeMode) {
                // Merge mode: add new system prompts without overwriting existing
                if (window.system_prompts) {
                    const existingNames = new Set(window.system_prompts.map(p => p.name));
                    systemPromptData.forEach(archivedPrompt => {
                        if (!existingNames.has(archivedPrompt.name)) {
                            try {
                                // Use the preset manager if available
                                if (syspromptManager && typeof syspromptManager.savePreset === 'function') {
                                    syspromptManager.savePreset(archivedPrompt.name, archivedPrompt);
                                    console.log(`${LOG_PREFIX} Successfully restored system prompt: ${archivedPrompt.name}`);
                                } else {
                                    // Fallback to direct addition
                                    window.system_prompts.push({...archivedPrompt});
                                    console.log(`${LOG_PREFIX} Added system prompt directly: ${archivedPrompt.name}`);
                                }
                                successCount++;
                            } catch (error) {
                                console.error(`${LOG_PREFIX} Error adding system prompt ${archivedPrompt.name}:`, error);
                                failCount++;
                            }
                        } else {
                            console.log(`${LOG_PREFIX} Skipping existing system prompt: ${archivedPrompt.name}`);
                        }
                    });
                }
            } else {
                // Replace mode: clear existing and add archived ones
                if (window.system_prompts) {
                    window.system_prompts.length = 0;
                    
                    systemPromptData.forEach(archivedPrompt => {
                        try {
                            if (syspromptManager && typeof syspromptManager.savePreset === 'function') {
                                syspromptManager.savePreset(archivedPrompt.name, archivedPrompt);
                                console.log(`${LOG_PREFIX} Successfully restored system prompt: ${archivedPrompt.name}`);
                            } else {
                                window.system_prompts.push({...archivedPrompt});
                                console.log(`${LOG_PREFIX} Added system prompt directly: ${archivedPrompt.name}`);
                            }
                            successCount++;
                        } catch (error) {
                            console.error(`${LOG_PREFIX} Error restoring system prompt ${archivedPrompt.name}:`, error);
                            failCount++;
                        }
                    });
                }
            }

            // Trigger save and update UI
            saveSettingsDebounced();
            this.refreshSystemPromptUI();
            
            console.log(`${LOG_PREFIX} System prompt restoration completed: ${successCount} successful, ${failCount} failed`);
            return failCount === 0;
            
        } catch (error) {
            console.error(`${LOG_PREFIX} Error in restoreSystemPrompts:`, error);
            return false;
        }
    },

    refreshPromptUI: function() {
        // Trigger prompt manager refresh if available
        if (window.promptManager && typeof window.promptManager.render === 'function') {
            window.promptManager.render();
        }
        
        // Trigger event to notify other parts of the system
        eventSource.emit(event_types.OAI_PRESET_CHANGED_AFTER);
    },

    refreshSystemPromptUI: function() {
        // Refresh system prompt UI
        if (window.updateSystemPromptPresetList && typeof window.updateSystemPromptPresetList === 'function') {
            window.updateSystemPromptPresetList();
        }
    },

    // Delete an archive
    deleteArchive: function(archiveId) {
        if (this.archives[archiveId]) {
            const archiveName = this.archives[archiveId].name;
            delete this.archives[archiveId];
            this.saveArchives();
            console.log(`${LOG_PREFIX} Deleted archive: ${archiveName}`);
            return true;
        }
        return false;
    },

    // Get all archives
    getAllArchives: function() {
        return Object.values(this.archives).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    // Get archive by ID
    getArchive: function(archiveId) {
        return this.archives[archiveId];
    },

    // Export archive to file
    exportArchive: function(archiveId) {
        const archive = this.archives[archiveId];
        if (!archive) return null;

        const exportData = {
            type: 'nemo_prompt_archive',
            version: '1.0',
            archive: archive
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${archive.name.replace(/[^a-zA-Z0-9]/g, '_')}_archive.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return true;
    },

    // Import archive from file
    importArchive: function(fileContent) {
        try {
            const importData = JSON.parse(fileContent);
            
            if (importData.type !== 'nemo_prompt_archive') {
                throw new Error('Invalid archive format');
            }

            const archive = importData.archive;
            const newId = `imported_${Date.now()}_${archive.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
            
            // Update archive with new ID and import timestamp
            archive.id = newId;
            archive.importedAt = new Date().toISOString();
            
            this.archives[newId] = archive;
            this.saveArchives();
            
            console.log(`${LOG_PREFIX} Imported archive: ${archive.name}`);
            return newId;
        } catch (error) {
            console.error(`${LOG_PREFIX} Error importing archive:`, error);
            return null;
        }
    },

    // Compare current prompts with an archive
    compareWithArchive: function(archiveId) {
        const archive = this.archives[archiveId];
        if (!archive) return null;

        const currentPrompts = this.getCurrentPrompts();
        const currentSystemPrompts = this.getCurrentSystemPrompts();

        return {
            prompts: {
                current: currentPrompts.prompts.length,
                archived: archive.promptData.prompts.length,
                different: JSON.stringify(currentPrompts.prompts) !== JSON.stringify(archive.promptData.prompts)
            },
            systemPrompts: {
                current: currentSystemPrompts.length,
                archived: archive.systemPromptData.length,
                different: JSON.stringify(currentSystemPrompts) !== JSON.stringify(archive.systemPromptData)
            }
        };
    },

    // Add a single prompt from an archive to the current preset
    addPromptToCurrentPreset: function(archiveId, promptIdentifier) {
        const archive = this.archives[archiveId];
        if (!archive) {
            console.error(`${LOG_PREFIX} Archive not found: ${archiveId}`);
            return false;
        }

        const prompt = archive.promptData.prompts.find(p => p.identifier === promptIdentifier);
        if (!prompt) {
            console.error(`${LOG_PREFIX} Prompt not found in archive: ${promptIdentifier}`);
            return false;
        }

        try {
            if (!window.promptManager) {
                console.error(`${LOG_PREFIX} PromptManager not available`);
                return false;
            }

            // Check if prompt already exists
            const existingPrompt = window.promptManager.getPromptById(prompt.identifier);
            if (existingPrompt) {
                console.log(`${LOG_PREFIX} Prompt ${prompt.identifier} already exists, skipping`);
                return false;
            }

            // Create a copy of the prompt with a new identifier if needed
            const newPrompt = { ...prompt };
            
            // Generate new identifier if one with same ID exists
            if (window.promptManager.getPromptById(newPrompt.identifier)) {
                newPrompt.identifier = `${newPrompt.identifier}_${Date.now()}`;
            }

            // Add prompt to the prompts array
            window.promptManager.addPrompt(newPrompt, newPrompt.identifier);
            
            // Add it to the active character's prompt order
            this.addPromptToActiveOrder(newPrompt);
            
            // Trigger save and update UI
            saveSettingsDebounced();
            this.refreshPromptUI();
            
            console.log(`${LOG_PREFIX} Successfully added prompt to current preset: ${newPrompt.name || newPrompt.identifier}`);
            return true;
            
        } catch (error) {
            console.error(`${LOG_PREFIX} Error adding prompt to current preset:`, error);
            return false;
        }
    },

    // Add a single system prompt from an archive to the current preset
    addSystemPromptToCurrentPreset: function(archiveId, systemPromptName) {
        const archive = this.archives[archiveId];
        if (!archive) {
            console.error(`${LOG_PREFIX} Archive not found: ${archiveId}`);
            return false;
        }

        const systemPrompt = archive.systemPromptData.find(p => p.name === systemPromptName);
        if (!systemPrompt) {
            console.error(`${LOG_PREFIX} System prompt not found in archive: ${systemPromptName}`);
            return false;
        }

        try {
            const syspromptManager = window.getPresetManager ? window.getPresetManager('sysprompt') : null;
            
            if (!syspromptManager && !window.system_prompts) {
                console.error(`${LOG_PREFIX} System prompt manager not available`);
                return false;
            }

            // Check if system prompt already exists
            if (window.system_prompts && window.system_prompts.find(p => p.name === systemPrompt.name)) {
                console.log(`${LOG_PREFIX} System prompt ${systemPrompt.name} already exists, skipping`);
                return false;
            }

            // Add the system prompt
            if (syspromptManager && typeof syspromptManager.savePreset === 'function') {
                syspromptManager.savePreset(systemPrompt.name, systemPrompt);
            } else if (window.system_prompts) {
                window.system_prompts.push({...systemPrompt});
            }

            // Trigger save and update UI
            saveSettingsDebounced();
            this.refreshSystemPromptUI();
            
            console.log(`${LOG_PREFIX} Successfully added system prompt to current preset: ${systemPrompt.name}`);
            return true;
            
        } catch (error) {
            console.error(`${LOG_PREFIX} Error adding system prompt to current preset:`, error);
            return false;
        }
    },

    // Get archive statistics
    getArchiveStats: function() {
        const archives = Object.values(this.archives);
        return {
            totalArchives: archives.length,
            totalPrompts: archives.reduce((sum, arch) => sum + (arch.metadata.totalPrompts || 0), 0),
            totalSystemPrompts: archives.reduce((sum, arch) => sum + (arch.metadata.totalSystemPrompts || 0), 0),
            oldestArchive: archives.length > 0 ? archives.reduce((oldest, arch) => 
                new Date(arch.timestamp) < new Date(oldest.timestamp) ? arch : oldest
            ) : null,
            newestArchive: archives.length > 0 ? archives.reduce((newest, arch) => 
                new Date(arch.timestamp) > new Date(newest.timestamp) ? arch : newest
            ) : null
        };
    }
};