// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - Asset Pack Manager

import { AssetPackSystem } from './AssetPackSystem.js';

export class AssetPackManager {
    constructor() {
        this.packSystem = new AssetPackSystem();
        this.packStorage = new Map();
        this.packDatabase = [];
        this.importedPacks = new Map();
        this.packTemplates = new Map();

        this.initializePackTemplates();
    }

    /**
     * Import asset pack from file or URL
     */
    async importPack(source, type = 'file') {
        try {
            let packData;

            if (type === 'file') {
                packData = await this.importFromFile(source);
            } else if (type === 'url') {
                packData = await this.importFromUrl(source);
            } else if (type === 'text') {
                packData = await this.importFromText(source);
            } else {
                throw new Error(`Unknown import type: ${type}`);
            }

            const pack = await this.packSystem.registerPack(packData);
            this.savePack(pack);

            console.log(`[Ember Pack Manager] Successfully imported pack: ${pack.id}`);
            return pack;

        } catch (error) {
            console.error('[Ember Pack Manager] Import failed:', error);
            throw error;
        }
    }

    /**
     * Import pack from file input
     */
    async importFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const content = e.target.result;

                    if (file.name.endsWith('.json')) {
                        // JSON pack format
                        const packData = JSON.parse(content);
                        resolve(packData);
                    } else if (file.name.endsWith('.js')) {
                        // JavaScript pack
                        resolve({
                            content: content,
                            htmlContent: '',
                            cssContent: '',
                            assets: {}
                        });
                    } else if (file.name.endsWith('.zip')) {
                        // ZIP package
                        this.importFromZip(content).then(resolve).catch(reject);
                    } else {
                        // Assume it's a raw pack file
                        resolve({
                            content: content,
                            htmlContent: '',
                            cssContent: '',
                            assets: {}
                        });
                    }
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));

            if (file.name.endsWith('.zip')) {
                reader.readAsArrayBuffer(file);
            } else {
                reader.readAsText(file);
            }
        });
    }

    /**
     * Import pack from URL
     */
    async importFromUrl(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');

            if (contentType?.includes('application/json')) {
                const packData = await response.json();
                return packData;
            } else {
                const content = await response.text();
                return {
                    content: content,
                    htmlContent: '',
                    cssContent: '',
                    assets: {}
                };
            }
        } catch (error) {
            throw new Error(`Failed to import from URL: ${error.message}`);
        }
    }

    /**
     * Import pack from text content
     */
    async importFromText(text) {
        try {
            // Try to parse as JSON first
            const packData = JSON.parse(text);
            return packData;
        } catch {
            // Treat as raw JavaScript
            return {
                content: text,
                htmlContent: '',
                cssContent: '',
                assets: {}
            };
        }
    }

    /**
     * Import pack from ZIP file
     */
    async importFromZip(zipData) {
        try {
            // Load JSZip library if not already available
            if (typeof JSZip === 'undefined') {
                await this.loadJSZip();
            }

            const zip = new JSZip();
            const zipContent = await zip.loadAsync(zipData);

            // Validate ZIP structure first
            const validation = await this.validateZipStructure(zipData);
            if (!validation.valid) {
                throw new Error(`Invalid asset pack ZIP: ${validation.error}`);
            }

            // Look for pack manifest
            const manifestFile = zipContent.file('pack.json') || zipContent.file('manifest.json');
            if (!manifestFile) {
                throw new Error('Invalid asset pack ZIP: Missing pack.json or manifest.json');
            }

            const manifestText = await manifestFile.async('text');
            let manifest;
            try {
                manifest = JSON.parse(manifestText);
            } catch (error) {
                throw new Error('Invalid manifest file: Invalid JSON format');
            }

            // Validate required manifest fields
            if (!manifest.name) {
                throw new Error('Invalid manifest: Missing required field "name"');
            }

            // Initialize pack data structure with validation
            const packData = {
                content: '',
                htmlContent: '',
                cssContent: '',
                assets: {},
                metadata: {
                    name: manifest.name,
                    displayName: manifest.displayName || manifest.name,
                    version: manifest.version || '1.0.0',
                    description: manifest.description || '',
                    author: manifest.author || 'Unknown',
                    importedAt: new Date().toISOString(),
                    ...manifest.metadata
                },
                stateSchema: manifest.stateSchema || {},
                chatInjection: manifest.chatInjection || {},
                positioning: manifest.positioning || { type: 'end' }
            };

            // Load main JavaScript file
            const jsFile = zipContent.file('index.js') || zipContent.file('main.js') || zipContent.file(manifest.main || 'pack.js');
            if (jsFile) {
                packData.content = await jsFile.async('text');
            }

            // Load HTML file
            const htmlFile = zipContent.file('index.html') || zipContent.file('template.html');
            if (htmlFile) {
                packData.htmlContent = await htmlFile.async('text');
            }

            // Load CSS file
            const cssFile = zipContent.file('style.css') || zipContent.file('styles.css');
            if (cssFile) {
                packData.cssContent = await cssFile.async('text');
            }

            // Load assets from assets folder
            const assetFiles = Object.keys(zipContent.files).filter(path =>
                path.startsWith('assets/') && !zipContent.files[path].dir
            );

            for (const assetPath of assetFiles) {
                const file = zipContent.file(assetPath);
                if (file) {
                    // Determine if it's a binary file
                    const extension = assetPath.split('.').pop().toLowerCase();
                    const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'woff', 'woff2', 'ttf', 'otf'];

                    if (binaryExtensions.includes(extension)) {
                        // Store as base64 data URL
                        const arrayBuffer = await file.async('arraybuffer');
                        const blob = new Blob([arrayBuffer]);
                        const dataUrl = await this.blobToDataUrl(blob);
                        packData.assets[assetPath] = dataUrl;
                    } else {
                        // Store as text
                        packData.assets[assetPath] = await file.async('text');
                    }
                }
            }

            // Calculate and validate pack size
            const packSize = this.calculatePackSize(packData);
            const maxSize = 50 * 1024 * 1024; // 50MB limit
            if (packSize > maxSize) {
                console.warn(`[Asset Pack Manager] Large pack detected: ${this.formatFileSize(packSize)}`);
            }

            console.log(`[Asset Pack Manager] Successfully imported ZIP: ${packData.metadata.name}`);
            console.log(`[Asset Pack Manager] Pack details: ${Object.keys(packData.assets).length} assets, ${this.formatFileSize(packSize)}`);

            return packData;

        } catch (error) {
            console.error('[Asset Pack Manager] ZIP import failed:', error);
            throw new Error(`Failed to import ZIP file: ${error.message}`);
        }
    }

    /**
     * Export pack to various formats
     */
    async exportPack(packId, format = 'json') {
        const pack = this.packSystem.getPack(packId);
        if (!pack) {
            throw new Error(`Pack ${packId} not found`);
        }

        switch (format) {
            case 'json':
                return this.exportAsJson(pack);
            case 'js':
                return this.exportAsJavaScript(pack);
            case 'zip':
                return this.exportAsZip(pack);
            default:
                throw new Error(`Unknown export format: ${format}`);
        }
    }

    /**
     * Export pack as JSON
     */
    exportAsJson(pack) {
        const exportData = {
            name: pack.metadata.name,
            displayName: pack.metadata.displayName,
            version: pack.metadata.version,
            description: pack.metadata.description,
            author: pack.metadata.author,
            content: pack.content,
            htmlContent: pack.htmlContent,
            cssContent: pack.cssContent,
            assets: pack.assets,
            metadata: pack.metadata,
            exportedAt: new Date().toISOString()
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Export pack as standalone JavaScript
     */
    exportAsJavaScript(pack) {
        return `// Asset Pack: ${pack.metadata.displayName || pack.id}
// Generated by Ember 2.0 on ${new Date().toISOString()}

//@name ${pack.metadata.name}
${pack.metadata.displayName ? `//@display-name ${pack.metadata.displayName}` : ''}
//@version ${pack.metadata.version}
//@description ${pack.metadata.description}
//@author ${pack.metadata.author}

${Object.entries(pack.metadata.args || {}).map(([name, def]) =>
    `//@arg ${name} ${def.type} ${def.default}`
).join('\n')}

${pack.metadata.exports?.map(exp => `//@export ${exp}`).join('\n') || ''}

${pack.content}`;
    }

    /**
     * Export pack as ZIP
     */
    async exportAsZip(pack) {
        try {
            // Load JSZip library if not already available
            if (typeof JSZip === 'undefined') {
                await this.loadJSZip();
            }

            const zip = new JSZip();

            // Create manifest
            const manifest = {
                name: pack.metadata.name,
                displayName: pack.metadata.displayName,
                version: pack.metadata.version || '1.0.0',
                description: pack.metadata.description,
                author: pack.metadata.author,
                metadata: pack.metadata,
                stateSchema: pack.stateSchema || {},
                chatInjection: pack.chatInjection || {},
                positioning: pack.positioning || { type: 'end' },
                main: 'index.js',
                exportedAt: new Date().toISOString()
            };

            zip.file('pack.json', JSON.stringify(manifest, null, 2));

            // Add main JavaScript file
            if (pack.content) {
                zip.file('index.js', pack.content);
            }

            // Add HTML template
            if (pack.htmlContent) {
                zip.file('index.html', pack.htmlContent);
            }

            // Add CSS styles
            if (pack.cssContent) {
                zip.file('style.css', pack.cssContent);
            }

            // Add assets folder
            if (pack.assets && Object.keys(pack.assets).length > 0) {
                for (const [assetPath, assetContent] of Object.entries(pack.assets)) {
                    if (assetContent.startsWith('data:')) {
                        // Convert data URL back to binary
                        const [header, base64Data] = assetContent.split(',');
                        const binaryData = atob(base64Data);
                        const bytes = new Uint8Array(binaryData.length);
                        for (let i = 0; i < binaryData.length; i++) {
                            bytes[i] = binaryData.charCodeAt(i);
                        }
                        zip.file(assetPath, bytes);
                    } else {
                        // Text asset
                        zip.file(assetPath, assetContent);
                    }
                }
            }

            // Add README with usage instructions
            const readmeContent = `# ${pack.metadata.displayName || pack.metadata.name}

${pack.metadata.description || 'Asset pack created with Ember 2.0'}

## Author
${pack.metadata.author || 'Unknown'}

## Version
${pack.metadata.version || '1.0.0'}

## Installation
1. Download this ZIP file
2. Open SillyTavern
3. Go to Extensions > Ember
4. Click "Import Asset Pack"
5. Select this ZIP file

## Generated
This asset pack was exported from Ember 2.0 on ${new Date().toLocaleString()}
`;
            zip.file('README.md', readmeContent);

            // Generate ZIP file
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            console.log(`[Asset Pack Manager] Generated ZIP export for pack: ${pack.id}`);
            return zipBlob;

        } catch (error) {
            throw new Error(`Failed to export ZIP file: ${error.message}`);
        }
    }

    /**
     * Create pack from template
     */
    async createFromTemplate(templateName, packName, options = {}) {
        const template = this.packTemplates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        const packData = template.generate(packName, options);
        const pack = await this.packSystem.registerPack(packData);
        this.savePack(pack);

        console.log(`[Ember Pack Manager] Created pack from template: ${templateName} -> ${pack.id}`);
        return pack;
    }

    /**
     * Save pack to persistent storage
     */
    savePack(pack) {
        // Save to extension settings
        const packData = {
            id: pack.id,
            metadata: pack.metadata,
            content: pack.content,
            htmlContent: pack.htmlContent,
            cssContent: pack.cssContent,
            assets: pack.assets,
            savedAt: Date.now()
        };

        this.packDatabase.push(packData);
        this.packStorage.set(pack.id, packData);

        // Persist to extension settings
        this.saveToSettings();
    }

    /**
     * Load packs from persistent storage
     */
    async loadPacks() {
        try {
            const savedPacks = this.loadFromSettings();
            for (const packData of savedPacks) {
                await this.packSystem.registerPack(packData);
                this.packStorage.set(packData.id, packData);
                console.log(`[Ember Pack Manager] Loaded pack: ${packData.id}`);
            }

            console.log(`[Ember Pack Manager] Loaded ${savedPacks.length} packs from storage`);
        } catch (error) {
            console.error('[Ember Pack Manager] Failed to load packs:', error);
        }
    }

    /**
     * Remove pack
     */
    removePack(packId) {
        const pack = this.packSystem.getPack(packId);
        if (!pack) {
            throw new Error(`Pack ${packId} not found`);
        }

        // Remove from system
        this.packSystem.unloadPack(packId);

        // Remove from storage
        this.packStorage.delete(packId);
        this.packDatabase = this.packDatabase.filter(p => p.id !== packId);
        this.saveToSettings();

        console.log(`[Ember Pack Manager] Removed pack: ${packId}`);
    }

    /**
     * Get all available packs
     */
    getAvailablePacks() {
        return this.packSystem.getPacks();
    }

    /**
     * Search packs by various criteria
     */
    searchPacks(query) {
        const packs = this.getAvailablePacks();
        const lowerQuery = query.toLowerCase();

        return packs.filter(pack =>
            pack.metadata.name?.toLowerCase().includes(lowerQuery) ||
            pack.metadata.displayName?.toLowerCase().includes(lowerQuery) ||
            pack.metadata.description?.toLowerCase().includes(lowerQuery) ||
            pack.metadata.author?.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Install pack from remote repository
     */
    async installFromRepository(packUrl) {
        try {
            console.log(`[Ember Pack Manager] Installing pack from: ${packUrl}`);
            const pack = await this.importFromUrl(packUrl);
            return pack;
        } catch (error) {
            console.error('[Ember Pack Manager] Repository install failed:', error);
            throw error;
        }
    }

    /**
     * Initialize built-in pack templates
     */
    initializePackTemplates() {
        // Dating Sim Template
        this.packTemplates.set('dating-sim', {
            name: 'Dating Sim',
            description: 'Interactive dating simulation with relationship tracking',
            generate: (packName, options) => ({
                content: `
//@name ${packName}
//@display-name ${options.displayName || packName}
//@description Interactive dating simulation
//@author ${options.author || 'Ember User'}
//@arg relationship_status string "single"
//@arg trust_level number 0
//@arg affection_level number 0
//@arg last_interaction string ""
//@context-field relationship_status string Current relationship status
//@context-field trust_level number Trust level (0-100)
//@context-field affection_level number Affection level (0-100)

// Dating sim state
const state = {
    relationship: getArg('relationship_status'),
    trust: getArg('trust_level'),
    affection: getArg('affection_level'),
    lastInteraction: getArg('last_interaction')
};

// Create UI
const container = document.createElement('div');
container.style.cssText = 'font-family: Arial; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: white;';

const title = document.createElement('h2');
title.textContent = '💕 ${options.characterName || "Dating Sim"}';
container.appendChild(title);

// Status display
const statusDiv = document.createElement('div');
statusDiv.innerHTML = \`
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0;">
        <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
            <strong>Relationship:</strong> \${state.relationship}
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
            <strong>Trust:</strong> \${state.trust}/100
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
            <strong>Affection:</strong> \${state.affection}/100
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 5px;">
            <strong>Last:</strong> \${state.lastInteraction || 'None'}
        </div>
    </div>
\`;
container.appendChild(statusDiv);

// Action buttons
const actionsDiv = document.createElement('div');
actionsDiv.innerHTML = \`
    <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 15px;">
        <button onclick="compliment()" style="padding: 10px 15px; border: none; border-radius: 5px; background: #ff6b9d; color: white; cursor: pointer;">Give Compliment</button>
        <button onclick="gift()" style="padding: 10px 15px; border: none; border-radius: 5px; background: #a8e6cf; color: #333; cursor: pointer;">Give Gift</button>
        <button onclick="date()" style="padding: 10px 15px; border: none; border-radius: 5px; background: #ff8c42; color: white; cursor: pointer;">Ask on Date</button>
        <button onclick="heart_to_heart()" style="padding: 10px 15px; border: none; border-radius: 5px; background: #b4a7d6; color: white; cursor: pointer;">Heart-to-Heart</button>
    </div>
\`;
container.appendChild(actionsDiv);

// Action functions
window.compliment = () => {
    state.affection = Math.min(100, state.affection + 5);
    updateStats('compliment');
    ember.inject({ content: \`I gave a compliment. Affection increased to \${state.affection}/100.\` });
};

window.gift = () => {
    state.affection = Math.min(100, state.affection + 10);
    state.trust = Math.min(100, state.trust + 3);
    updateStats('gift');
    ember.inject({ content: \`I gave a gift. Affection: \${state.affection}/100, Trust: \${state.trust}/100.\` });
};

window.date = () => {
    if (state.affection >= 30) {
        state.affection = Math.min(100, state.affection + 15);
        state.trust = Math.min(100, state.trust + 10);
        updateStats('date');
        ember.inject({ content: \`We went on a date! Affection: \${state.affection}/100, Trust: \${state.trust}/100.\` });
    } else {
        ember.inject({ content: 'They declined the date invitation. Need more affection first.' });
    }
};

window.heart_to_heart = () => {
    if (state.trust >= 50) {
        state.trust = Math.min(100, state.trust + 20);
        if (state.trust >= 80 && state.affection >= 70) {
            state.relationship = 'dating';
        }
        updateStats('heart_to_heart');
        ember.inject({ content: \`We had a deep conversation. Trust: \${state.trust}/100. Relationship: \${state.relationship}\` });
    } else {
        ember.inject({ content: 'They are not ready for a deep conversation yet. Build more trust first.' });
    }
};

function updateStats(action) {
    state.lastInteraction = action;
    setArg('relationship_status', state.relationship);
    setArg('trust_level', state.trust);
    setArg('affection_level', state.affection);
    setArg('last_interaction', state.lastInteraction);

    // Update context fields
    ember.setContextField('relationship_status', state.relationship);
    ember.setContextField('trust_level', state.trust);
    ember.setContextField('affection_level', state.affection);
}

root.appendChild(container);
`,
                htmlContent: '',
                cssContent: '',
                assets: {}
            })
        });

        // Interactive Chart Template
        this.packTemplates.set('chart', {
            name: 'Interactive Chart',
            description: 'Customizable data visualization with Chart.js',
            generate: (packName, options) => ({
                content: `
//@name ${packName}
//@display-name ${options.displayName || packName}
//@description Interactive data chart
//@author ${options.author || 'Ember User'}
//@arg chart_type string "bar"
//@arg data_points string "10,20,30,40"
//@arg labels string "A,B,C,D"
//@arg title string "Sample Chart"

const canvas = document.createElement('canvas');
canvas.width = 400;
canvas.height = 300;

const chartType = getArg('chart_type');
const dataPoints = getArg('data_points').split(',').map(Number);
const labels = getArg('labels').split(',');
const title = getArg('title');

new Chart(canvas, {
    type: chartType,
    data: {
        labels: labels,
        datasets: [{
            label: 'Data',
            data: dataPoints,
            backgroundColor: [
                'rgba(255, 99, 132, 0.2)',
                'rgba(54, 162, 235, 0.2)',
                'rgba(255, 205, 86, 0.2)',
                'rgba(75, 192, 192, 0.2)'
            ],
            borderColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 205, 86, 1)',
                'rgba(75, 192, 192, 1)'
            ],
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: title
            }
        }
    }
});

root.appendChild(canvas);

ember.inject({ content: \`Displayed a \${chartType} chart titled "\${title}" with \${dataPoints.length} data points.\` });
`,
                htmlContent: '',
                cssContent: '',
                assets: {}
            })
        });

        console.log('[Ember Pack Manager] Initialized pack templates');
    }

    /**
     * Save to extension settings
     */
    saveToSettings() {
        if (window.ember?.settings) {
            window.ember.settings.assetPacks = this.packDatabase;
            window.ember.settings.save();
        }
    }

    /**
     * Load from extension settings
     */
    loadFromSettings() {
        if (window.ember?.settings?.assetPacks) {
            this.packDatabase = window.ember.settings.assetPacks;
            return this.packDatabase;
        }
        return [];
    }

    /**
     * Get pack templates
     */
    getTemplates() {
        return Array.from(this.packTemplates.entries()).map(([key, template]) => ({
            id: key,
            name: template.name,
            description: template.description
        }));
    }

    /**
     * Load JSZip library dynamically
     */
    async loadJSZip() {
        return new Promise((resolve, reject) => {
            if (typeof JSZip !== 'undefined') {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => {
                console.log('[Asset Pack Manager] JSZip library loaded');
                resolve();
            };
            script.onerror = () => {
                reject(new Error('Failed to load JSZip library'));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Convert blob to data URL
     */
    async blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Download file as ZIP
     */
    downloadAsZip(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Validate ZIP structure
     */
    async validateZipStructure(zipContent) {
        try {
            if (typeof JSZip === 'undefined') {
                await this.loadJSZip();
            }

            const zip = new JSZip();
            const content = await zip.loadAsync(zipContent);

            // Check for required files
            const hasManifest = content.file('pack.json') || content.file('manifest.json');
            if (!hasManifest) {
                return { valid: false, error: 'Missing pack.json or manifest.json' };
            }

            // Check for main script file
            const hasScript = content.file('index.js') || content.file('main.js') || content.file('pack.js');
            if (!hasScript) {
                return { valid: false, error: 'Missing main JavaScript file' };
            }

            return { valid: true };

        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Get pack statistics
     */
    getPackStats(packId) {
        const pack = this.packSystem.getPack(packId);
        if (!pack) {
            return null;
        }

        return {
            id: pack.id,
            size: this.calculatePackSize(pack),
            assetCount: Object.keys(pack.assets || {}).length,
            variables: Object.keys(pack.stateSchema || {}).length,
            lastModified: pack.metadata.lastModified || null,
            version: pack.metadata.version || '1.0.0'
        };
    }

    /**
     * Calculate pack size in bytes
     */
    calculatePackSize(pack) {
        let size = 0;

        // JavaScript content
        if (pack.content) {
            size += new Blob([pack.content]).size;
        }

        // HTML content
        if (pack.htmlContent) {
            size += new Blob([pack.htmlContent]).size;
        }

        // CSS content
        if (pack.cssContent) {
            size += new Blob([pack.cssContent]).size;
        }

        // Assets
        if (pack.assets) {
            for (const asset of Object.values(pack.assets)) {
                if (typeof asset === 'string') {
                    size += new Blob([asset]).size;
                }
            }
        }

        return size;
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}