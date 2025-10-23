// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - Universal Renderer (AI-Transparent)
// Automatically detects and runs ANY JavaScript/HTML without AI needing to know about Ember

import { AssetPack } from './AssetPack.js';

export class UniversalRenderer {
    constructor() {
        this.detectionPatterns = {
            // Ultra-permissive JavaScript detection
            javascript: [
                // Variable declarations
                /\b(const|let|var)\s+\w+/,
                // Function definitions
                /\bfunction\s+\w+\s*\(/,
                /\w+\s*=>\s*[{\(]/,
                /\(\s*\)\s*=>/,
                // DOM manipulation
                /document\./,
                /window\./,
                /\.getElementById/,
                /\.querySelector/,
                /\.createElement/,
                /\.appendChild/,
                /\.innerHTML/,
                /\.textContent/,
                /\.addEventListener/,
                // Common JavaScript methods
                /\.push\s*\(/,
                /\.map\s*\(/,
                /\.filter\s*\(/,
                /\.forEach\s*\(/,
                /\.reduce\s*\(/,
                /console\./,
                /JSON\./,
                /Math\./,
                /Array\./,
                /Object\./,
                // Control structures
                /\bif\s*\(/,
                /\bfor\s*\(/,
                /\bwhile\s*\(/,
                /\btry\s*\{/,
                /\bcatch\s*\(/,
                // Modern JavaScript
                /\basync\s+/,
                /\bawait\s+/,
                /\bclass\s+\w+/,
                /\bimport\s+/,
                /\bexport\s+/,
                // Operators and syntax
                /===|!==|&&|\|\||\.\.\.|\?\?|\?\./,
                // Template literals
                /`[^`]*\$\{[^}]*\}[^`]*`/,
                // Libraries commonly used
                /Chart\(/,
                /new\s+Chart/,
                /d3\./,
                /THREE\./,
                /p5\./,
                /anime\(/,
                /Matter\./,
                // Any function call pattern
                /\w+\s*\([^)]*\)\s*[;{]/
            ],

            // HTML detection (more permissive)
            html: [
                /<[a-zA-Z][^>]*>/,  // Any HTML tag
                /&[a-zA-Z]+;/,      // HTML entities
                /<\/?[a-zA-Z]+/     // Opening or closing tags
            ],

            // Interactive elements
            interactive: [
                /<(button|input|select|textarea|form)\b/i,
                /onclick\s*=/i,
                /onchange\s*=/i,
                /addEventListener/i
            ]
        };

        this.libraries = {
            // Updated to latest versions
            'chart': {
                url: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js',
                global: 'Chart',
                aliases: ['Chart', 'chartjs']
            },
            'd3': {
                url: 'https://cdn.jsdelivr.net/npm/d3@7.8.5/dist/d3.min.js',
                global: 'd3',
                aliases: ['d3']
            },
            'three': {
                url: 'https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js',
                global: 'THREE',
                aliases: ['three', 'THREE']
            },
            'p5': {
                url: 'https://cdn.jsdelivr.net/npm/p5@1.7.0/lib/p5.min.js',
                global: 'p5',
                aliases: ['p5']
            },
            'anime': {
                url: 'https://cdn.jsdelivr.net/npm/animejs@3.2.1/lib/anime.min.js',
                global: 'anime',
                aliases: ['anime']
            },
            'matter': {
                url: 'https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js',
                global: 'Matter',
                aliases: ['Matter', 'matter']
            },
            'fabric': {
                url: 'https://cdn.jsdelivr.net/npm/fabric@5.3.0/dist/fabric.min.js',
                global: 'fabric',
                aliases: ['fabric']
            },
            'pixi': {
                url: 'https://cdn.jsdelivr.net/npm/pixi.js@7.3.2/dist/pixi.min.js',
                global: 'PIXI',
                aliases: ['PIXI', 'pixi']
            }
        };

        this.libraryCache = new Map();
        this.activeRenders = new Map();

        // Asset pack system integration
        this.registeredAssetPacks = new Map();
        this.activeAssetPacks = new Map(); // Track globally active asset packs
        this.messageAssetPacks = new Map(); // Track which asset packs are active per message

        // AI response parsing
        this.aiResponseParsers = new Set();
        this.setupAIResponseParsing();
    }

    /**
     * Detect and extract code blocks from mixed RP content
     */
    detectContentType(content) {
        const trimmed = content.trim();

        // Skip very short content
        if (trimmed.length < 10) return null;

        // Extract code blocks from mixed content
        const extractedCode = this.extractCodeBlocks(content);

        if (extractedCode.length > 0) {
            // Found code blocks in mixed content
            return 'mixed';
        }

        return null;
    }

    /**
     * Extract code blocks from mixed roleplay/code content
     */
    extractCodeBlocks(content) {
        const codeBlocks = [];
        const usedRanges = []; // Track which parts of content we've already used

        // Extract markdown code blocks first (highest priority)
        const markdownBlockPattern = /```(\w+)?\s*\n?([\s\S]*?)```/g;
        let match;

        while ((match = markdownBlockPattern.exec(content)) !== null) {
            const language = match[1] || 'javascript';
            const code = match[2].trim();

            // Enhanced validation: Only process if it contains actual code
            if (code.length > 5 && this.isActualCode(code, language)) {
                codeBlocks.push({
                    type: this.normalizeLanguage(language),
                    code: code,
                    raw: match[0],
                    start: match.index,
                    end: match.index + match[0].length
                });

                usedRanges.push({ start: match.index, end: match.index + match[0].length });
            }
        }

        // Extract full HTML documents (second priority, but only if no markdown blocks found)
        if (codeBlocks.length === 0 && (content.includes('<!DOCTYPE html>') || content.includes('<html'))) {
            const htmlDocPattern = /<!DOCTYPE html>[\s\S]*?<\/html>|<html[\s\S]*?<\/html>/gi;
            while ((match = htmlDocPattern.exec(content)) !== null) {
                const code = match[0].trim();
                if (code.length > 50 && !this.overlapsWith(match.index, match.index + match[0].length, usedRanges)) {
                    codeBlocks.push({
                        type: 'html',
                        code: code,
                        raw: match[0],
                        start: match.index,
                        end: match.index + match[0].length
                    });

                    usedRanges.push({ start: match.index, end: match.index + match[0].length });
                    break; // Only take the first full HTML document
                }
            }
        }

        // Skip other extractions if we found markdown blocks or full HTML documents
        if (codeBlocks.length > 0) {
            return codeBlocks;
        }

        // Extract standalone JavaScript only if nothing else found
        const jsBlockPattern = /(?:^|\n\s*)((?:function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)[\s\S]*?)(?=\n\s*[*"]|\n\s*$|$)/gm;
        while ((match = jsBlockPattern.exec(content)) !== null) {
            const code = match[1].trim();
            if (code.length > 10 && this.looksLikeCode(code) &&
                !this.overlapsWith(match.index, match.index + match[0].length, usedRanges)) {
                codeBlocks.push({
                    type: 'javascript',
                    code: code,
                    raw: match[0],
                    start: match.index,
                    end: match.index + match[0].length
                });

                usedRanges.push({ start: match.index, end: match.index + match[0].length });
            }
        }

        return codeBlocks;
    }

    /**
     * Check if a range overlaps with existing used ranges
     */
    overlapsWith(start, end, usedRanges) {
        return usedRanges.some(range =>
            (start >= range.start && start < range.end) ||
            (end > range.start && end <= range.end) ||
            (start <= range.start && end >= range.end)
        );
    }

    /**
     * Normalize language identifiers
     */
    normalizeLanguage(lang) {
        const normalized = (lang || '').toLowerCase();
        switch (normalized) {
            case 'js':
            case 'javascript':
                return 'javascript';
            case 'html':
            case 'htm':
                return 'html';
            case 'css':
                return 'css';
            default:
                return 'javascript'; // Default fallback
        }
    }

    /**
     * Check if extracted text looks like actual code
     */
    looksLikeCode(text) {
        // Must have at least some code-like patterns
        const codeIndicators = [
            /\bfunction\s+\w+/,
            /\b(const|let|var)\s+\w+\s*=/,
            /\w+\s*\([^)]*\)\s*{/,
            /document\./,
            /window\./,
            /console\./,
            /\breturn\b/,
            /if\s*\([^)]+\)/,
            /for\s*\([^)]+\)/
        ];

        return codeIndicators.some(pattern => pattern.test(text));
    }

    /**
     * Enhanced method to check if content in code blocks is actually code
     * This prevents processing of text content that just happens to be in code blocks
     */
    isActualCode(content, language = 'javascript') {
        const trimmedContent = content.trim();
        
        // Very short content is likely not meaningful code
        if (trimmedContent.length < 10) {
            return false;
        }

        // Language-specific checks
        switch (language.toLowerCase()) {
            case 'html':
            case 'htm':
                return this.isActualHtml(trimmedContent);
            case 'css':
                return this.isActualCss(trimmedContent);
            case 'javascript':
            case 'js':
            default:
                return this.isActualJavaScript(trimmedContent);
        }
    }

    /**
     * Check if content is actual HTML code vs narrative text
     */
    isActualHtml(content) {
        // Must have actual HTML tags, not just angle brackets in text
        const htmlPatterns = [
            /<[a-zA-Z][a-zA-Z0-9]*\s*[^>]*>/,  // Opening tags
            /<\/[a-zA-Z][a-zA-Z0-9]*>/,        // Closing tags
            /<!DOCTYPE\s+html/i,               // DOCTYPE declaration
            /<html[^>]*>/i,                    // HTML tag
            /<head[^>]*>/i,                    // Head tag
            /<body[^>]*>/i                     // Body tag
        ];

        // Check for HTML structure indicators
        const hasHtmlStructure = htmlPatterns.some(pattern => pattern.test(content));
        
        // Check if it's NOT just narrative text with occasional HTML entities
        const narrativeIndicators = [
            /\b(said|says|whispered|shouted|replied|responded)\b/i,
            /\b(he|she|they|I|you)\s+(was|were|is|are)\b/i,
            /\*[^*]+\*/,  // *action text*
            /\b(walked|moved|stepped|approached|left|entered)\b/i,
            /\b(looked|glanced|stared|gazed|watched)\b/i
        ];

        const narrativeScore = narrativeIndicators.filter(pattern => pattern.test(content)).length;
        
        // If it has HTML structure and isn't heavily narrative, consider it HTML
        return hasHtmlStructure && narrativeScore < 2;
    }

    /**
     * Check if content is actual CSS code vs narrative text
     */
    isActualCss(content) {
        const cssPatterns = [
            /\{[^}]*\}/,                       // CSS rule blocks
            /[.#][\w-]+\s*\{/,                 // Class/ID selectors
            /\w+\s*:\s*[^;]+;/,                // Property: value; pairs
            /@(media|import|keyframes|font-face)\b/i, // CSS at-rules
            /[\w-]+\s*:\s*[\w-]+\s*;/          // Simple property declarations
        ];

        return cssPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Check if content is actual JavaScript code vs narrative text
     */
    isActualJavaScript(content) {
        // JavaScript-specific patterns
        const jsPatterns = [
            /\b(function|const|let|var|class|if|else|for|while|return|new|this)\b/,
            /\b(document|window|console)\./,
            /[=!]==|&&|\|\||\.\.\.|\?\?|\?\./,
            /\w+\s*\([^)]*\)\s*[{;]/,
            /\w+\s*=>\s*[{(]/,
            /\b(async|await|import|export)\b/,
            /\/\*[\s\S]*?\*\/|\/\/.*$/m,
            /`[^`]*\$\{[^}]*\}[^`]*`/
        ];

        // Check for code patterns
        const codeScore = jsPatterns.filter(pattern => pattern.test(content)).length;
        
        // Check for narrative/roleplay patterns that suggest it's not code
        const narrativePatterns = [
            /\b(said|says|whispered|shouted|replied|responded|asked|told)\b/i,
            /\b(he|she|they|I|you)\s+(was|were|is|are|will|would|could|should)\b/i,
            /\*[^*]+\*/,  // *action text*
            /\b(walked|moved|stepped|approached|left|entered|sat|stood)\b/i,
            /\b(looked|glanced|stared|gazed|watched|observed)\b/i,
            /\b(smiled|frowned|laughed|sighed|nodded|shook)\b/i,
            /\b(felt|thought|wondered|realized|noticed|remembered)\b/i,
            /^[A-Za-z][^:]*:\s*"/,  // Character name: "dialogue"
            /\b(suddenly|slowly|quickly|quietly|softly|gently)\b/i
        ];

        const narrativeScore = narrativePatterns.filter(pattern => pattern.test(content)).length;
        
        // Consider it code if:
        // 1. It has at least 2 code patterns AND less than 3 narrative patterns, OR
        // 2. It has a very high code score (4+), OR
        // 3. It has clear code structure but low narrative content
        return (codeScore >= 2 && narrativeScore < 3) ||
               (codeScore >= 4) ||
               (codeScore >= 1 && narrativeScore === 0 && content.length > 50);
    }

    /**
     * Check if content looks like roleplay/narrative text
     */
    isRoleplayText(content) {
        // Common roleplay patterns
        const roleplayPatterns = [
            /\*[^*]+\*/g,                    // *action text*
            /\b(says?|said|whispers?|shouts?|screams?|mutters?)\b/i,
            /\b(looks?|glances?|stares?|gazes?)\b/i,
            /\b(walks?|moves?|steps?|approaches?)\b/i,
            /\b(smiles?|grins?|frowns?|laughs?)\b/i,
            /\b(he|she|they|I)\s+(is|are|was|were)\b/i,
            /^[A-Za-z][^:]*:\s*"/,          // Character name: "dialogue"
            /\b(nods?|shakes?|tilts?)\s+(his|her|their)\s+head/i,
        ];

        let roleplayScore = 0;
        for (const pattern of roleplayPatterns) {
            if (pattern.test(content)) {
                roleplayScore++;
            }
        }

        // If it has many roleplay indicators, it's probably not code
        return roleplayScore >= 2;
    }

    /**
     * Check for explicit code block markers
     */
    hasCodeBlockMarkers(content) {
        return content.includes('```') ||
               content.includes('<script>') ||
               content.includes('// ') ||
               content.includes('/* ') ||
               content.startsWith('function ') ||
               content.startsWith('const ') ||
               content.startsWith('let ') ||
               content.startsWith('var ');
    }

    /**
     * Detect code block type from markers
     */
    detectCodeBlockType(content) {
        if (content.includes('```javascript') || content.includes('```js')) return 'javascript';
        if (content.includes('```html')) return 'html';
        if (content.includes('<script>') || content.includes('function ') ||
            content.includes('const ') || content.includes('let ')) return 'javascript';
        return 'javascript'; // Default for code blocks
    }

    /**
     * Auto-detect and load required libraries from code
     */
    detectRequiredLibraries(content) {
        const required = new Set();

        // Check for library usage in code
        for (const [libName, libInfo] of Object.entries(this.libraries)) {
            for (const alias of libInfo.aliases) {
                // Look for library usage patterns
                const patterns = [
                    new RegExp(`\\b${alias}\\s*\\(`, 'i'),           // Function calls
                    new RegExp(`\\bnew\\s+${alias}\\b`, 'i'),        // Constructor calls
                    new RegExp(`\\b${alias}\\.`, 'i'),               // Method calls
                    new RegExp(`\\b${alias}\\[`, 'i'),               // Property access
                ];

                if (patterns.some(pattern => pattern.test(content))) {
                    required.add(libName);
                    break;
                }
            }
        }

        // Always include Chart.js for any chart-related terms
        if (/chart|graph|plot|bar|line|pie|data/i.test(content)) {
            required.add('chart');
        }

        // Always include basic libraries for common patterns
        if (/canvas|draw|render|animate/i.test(content)) {
            required.add('p5');
            required.add('anime');
        }

        return Array.from(required);
    }

    /**
     * Load library from CDN with caching
     */
    async loadLibrary(libName) {
        if (this.libraryCache.has(libName)) {
            return this.libraryCache.get(libName);
        }

        const lib = this.libraries[libName];
        if (!lib) {
            console.warn(`[Ember Universal] Unknown library: ${libName}`);
            return '';
        }

        try {
            console.log(`[Ember Universal] Loading ${libName} from CDN: ${lib.url}`);
            const response = await fetch(lib.url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const code = await response.text();
            this.libraryCache.set(libName, code);
            console.log(`[Ember Universal] Successfully loaded ${libName} (${code.length} chars)`);
            return code;
        } catch (error) {
            console.error(`[Ember Universal] Failed to load ${libName}:`, error);
            this.libraryCache.set(libName, ''); // Cache empty to avoid retry
            return '';
        }
    }

    /**
     * Create universal sandbox that handles any code
     */
    async createUniversalSandbox(content, messageId) {
        // Detect required libraries
        const requiredLibs = this.detectRequiredLibraries(content);
        console.log(`[Ember Universal] Auto-detected libraries: ${requiredLibs.join(', ')}`);

        // Load all required libraries
        const libraryCodes = await Promise.all(
            requiredLibs.map(lib => this.loadLibrary(lib))
        );

        const frameId = `ember-universal-${messageId}-${Date.now()}`;
        const iframe = document.createElement('iframe');
        iframe.className = 'ember-iframe';
        iframe.sandbox = 'allow-scripts allow-same-origin';
        iframe.dataset.frameId = frameId;
        iframe.style.cssText = 'width: 100%; border: none; display: block; overflow: hidden; max-height: 600px; min-height: 100px;';

        // Create the most permissive sandbox possible
        const iframeContent = this.buildUniversalSandbox(content, libraryCodes, frameId);
        iframe.src = URL.createObjectURL(new Blob([iframeContent], { type: 'text/html' }));

        return { iframe, frameId };
    }

    /**
     * Build universal sandbox HTML that makes ANY code work
     */
    buildUniversalSandbox(userCode, libraryCodes, frameId) {
        const safeUserCode = JSON.stringify(userCode);
        const safeLibraries = JSON.stringify(libraryCodes);

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { box-sizing: border-box; }
        html, body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 8px;
            background: transparent;
            color: #333;
            line-height: 1.4;
            overflow: auto;
        }
        #root, #app, #main, .container {
            width: 100%; min-height: 50px;
        }
        canvas { max-width: 100%; height: auto; }
        button, input, select, textarea {
            font-family: inherit; font-size: inherit;
            padding: 6px 12px; margin: 4px;
            border: 1px solid #ddd; border-radius: 4px;
            background: white; color: #333;
        }
        button {
            background: #007bff; color: white; cursor: pointer;
            border-color: #007bff;
        }
        button:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div id="root"></div>
    <div id="app"></div>
    <div id="main"></div>
    <div class="container"></div>

    <script>
        (function() {
            const frameId = "${frameId}";
            const userCode = ${safeUserCode};
            const libraries = ${safeLibraries};

            // Message passing
            const postMessage = (type, data) => {
                parent.postMessage({
                    type: 'ember-' + type,
                    frameId: frameId,
                    ...data
                }, '*');
            };

            // Global error handling
            window.onerror = (msg, url, line, col, error) => {
                console.error('Runtime error:', error || msg);
                postMessage('error', {
                    message: error ? (error.stack || error.message) : msg
                });
                return true;
            };

            // Unhandled promise rejections
            window.addEventListener('unhandledrejection', event => {
                console.error('Unhandled promise rejection:', event.reason);
                postMessage('error', {
                    message: 'Promise rejection: ' + (event.reason?.message || event.reason)
                });
            });

            // Create universal DOM access points
            const root = document.getElementById('root');
            const app = document.getElementById('app');
            const main = document.getElementById('main');
            const container = document.querySelector('.container');

            // Smart element creation system
            const createdElements = new Set();

            function createMissingElement(id, tag = 'div') {
                if (createdElements.has(id)) {
                    return document.getElementById(id);
                }

                console.log('[Universal] Auto-creating element:', id);
                const element = document.createElement(tag);
                element.id = id;

                // Smart placement
                if (root && !root.hasChildNodes()) {
                    root.appendChild(element);
                } else if (document.body.children.length < 10) {
                    document.body.appendChild(element);
                } else {
                    root.appendChild(element);
                }

                createdElements.add(id);
                return element;
            }

            // Override document.getElementById to auto-create
            const originalGetElementById = document.getElementById;
            document.getElementById = function(id) {
                let element = originalGetElementById.call(document, id);
                if (!element && id !== 'root' && id !== 'app' && id !== 'main') {
                    element = createMissingElement(id);
                }
                return element;
            };

            // Override querySelector to auto-create for ID selectors
            const originalQuerySelector = document.querySelector;
            document.querySelector = function(selector) {
                let element = originalQuerySelector.call(document, selector);
                if (!element && selector.startsWith('#')) {
                    const id = selector.substring(1);
                    element = createMissingElement(id);
                }
                return element || originalQuerySelector.call(document, selector);
            };

            // Redirect common appendChild targets
            const originalBodyAppendChild = document.body.appendChild;
            document.body.appendChild = function(element) {
                // If body is getting too crowded, use root instead
                if (document.body.children.length > 5 && root) {
                    console.log('[Universal] Redirecting appendChild to root');
                    return root.appendChild(element);
                }
                return originalBodyAppendChild.call(document.body, element);
            };

            // Auto-inject context for interactions (transparent to AI)
            function setupAutoContext() {
                document.addEventListener('click', (e) => {
                    if (e.target.tagName === 'BUTTON') {
                        const text = e.target.textContent.trim();
                        if (text) {
                            postMessage('auto-context', {
                                content: \`Button clicked: "\${text}"\`,
                                trigger: 'button_click'
                            });
                        }
                    }
                });

                document.addEventListener('change', (e) => {
                    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
                        const label = e.target.previousElementSibling?.textContent ||
                                     e.target.placeholder ||
                                     e.target.name ||
                                     'form field';
                        const value = e.target.value;
                        if (value) {
                            postMessage('auto-context', {
                                content: \`\${label}: \${value}\`,
                                trigger: 'input_change'
                            });
                        }
                    }
                });
            }

            // Resize observer
            const resizeObserver = new ResizeObserver(() => {
                const height = Math.max(
                    document.documentElement.scrollHeight,
                    document.body.scrollHeight,
                    100
                );
                postMessage('resize', { height });
            });
            resizeObserver.observe(document.documentElement);

            // Success detection
            let hasContent = false;
            const successDetector = new MutationObserver(() => {
                const hasVisualContent =
                    root.hasChildNodes() ||
                    app.hasChildNodes() ||
                    main.hasChildNodes() ||
                    container.hasChildNodes() ||
                    document.body.children.length > 4; // More than our basic divs

                if (hasVisualContent && !hasContent) {
                    hasContent = true;
                    postMessage('success', {});
                    console.log('[Universal] Content detected, execution successful');
                }
            });

            [root, app, main, container, document.body].forEach(el => {
                if (el) successDetector.observe(el, { childList: true, subtree: true });
            });

            // Initialize
            async function initialize() {
                try {
                    // Load all libraries
                    console.log('[Universal] Loading', libraries.length, 'libraries...');
                    for (const libCode of libraries) {
                        if (libCode) {
                            const script = document.createElement('script');
                            script.textContent = libCode;
                            document.head.appendChild(script);
                        }
                    }

                    // Setup auto-context system
                    setupAutoContext();

                    // Execute user code with maximum compatibility
                    console.log('[Universal] Executing user code...');

                    // Make common elements globally available
                    window.root = root;
                    window.app = app;
                    window.main = main;
                    window.container = container;

                    // Execute in different ways to maximize compatibility
                    try {
                        // Method 1: Direct execution
                        eval(userCode);
                    } catch (e1) {
                        console.log('[Universal] Direct execution failed, trying function wrapper...');
                        try {
                            // Method 2: Function wrapper
                            new Function('root', 'app', 'main', 'container', userCode)(root, app, main, container);
                        } catch (e2) {
                            console.log('[Universal] Function wrapper failed, trying async wrapper...');
                            try {
                                // Method 3: Async wrapper
                                new Function('root', 'app', 'main', 'container', 'return (async () => {' + userCode + '})()')(root, app, main, container);
                            } catch (e3) {
                                throw e1; // Throw original error
                            }
                        }
                    }

                    // If still no content after a delay, consider it successful anyway
                    setTimeout(() => {
                        if (!hasContent) {
                            hasContent = true;
                            postMessage('success', {});
                        }
                    }, 1000);

                } catch (error) {
                    console.error('[Universal] Execution error:', error);
                    postMessage('error', {
                        message: error.stack || error.message || 'Unknown execution error'
                    });
                }
            }

            // Start initialization
            initialize();
        })();
    </script>
</body>
</html>`;
    }

    /**
     * Render any content universally
     */
    async renderContent(messageId, messageElement, content) {
        const contentType = this.detectContentType(content);

        if (!contentType) {
            return false; // Not renderable content
        }

        console.log(`[Ember Universal] Rendering ${contentType} content for message ${messageId}`);

        try {
            if (contentType === 'mixed') {
                // Mixed RP and code content - extract and render code blocks
                return await this.renderMixedContent(messageId, messageElement, content);
            } else if (contentType === 'html' && !content.includes('script')) {
                // Pure HTML - render directly
                return await this.renderPureHtml(messageId, messageElement, content);
            } else {
                // JavaScript - use universal sandbox
                return await this.renderInSandbox(messageId, messageElement, content);
            }
        } catch (error) {
            console.error(`[Ember Universal] Rendering failed:`, error);
            this.showError(messageElement, error);
            return false;
        }
    }

    /**
     * Render mixed roleplay and code content
     */
    async renderMixedContent(messageId, messageElement, content) {
        const codeBlocks = this.extractCodeBlocks(content);

        if (codeBlocks.length === 0) {
            return false;
        }

        console.log(`[Ember Universal] Found ${codeBlocks.length} code blocks in mixed content`);

        let renderCount = 0;
        for (let i = 0; i < codeBlocks.length; i++) {
            const block = codeBlocks[i];

            try {
                // Find and hide the original code block in the DOM, get insertion point
                const insertionPoint = this.hideOriginalCodeBlock(messageElement, block);
                const targetElement = insertionPoint || messageElement;

                if (block.type === 'html') {
                    if (this.isFullHtmlDocument(block.code)) {
                        // Full HTML document - render directly in iframe
                        await this.renderFullHtmlDocument(`${messageId}-${i}`, targetElement, block.code, insertionPoint);
                    } else if (!block.code.includes('script')) {
                        // HTML fragment without scripts - render directly
                        await this.renderPureHtml(`${messageId}-${i}`, targetElement, block.code, insertionPoint);
                    } else {
                        // HTML with scripts - use sandbox
                        await this.renderInSandbox(`${messageId}-${i}`, targetElement, block.code, insertionPoint);
                    }
                } else {
                    // JavaScript - use sandbox
                    await this.renderInSandbox(`${messageId}-${i}`, targetElement, block.code, insertionPoint);
                }
                renderCount++;
            } catch (error) {
                console.error(`[Ember Universal] Failed to render code block ${i}:`, error);
                this.showError(messageElement, error);
            }
        }

        return renderCount > 0;
    }

    /**
     * Hide the original code block in the DOM and return insertion point
     */
    hideOriginalCodeBlock(messageElement, block) {
        try {
            // Look for code blocks in the message element
            const codeElements = messageElement.querySelectorAll('pre code, code');

            for (const codeElement of codeElements) {
                const elementText = codeElement.textContent || codeElement.innerText;

                // Check if this code element contains our extracted code
                if (elementText.includes(block.code.substring(0, Math.min(100, block.code.length)))) {
                    // Hide the parent pre element if it exists, otherwise hide the code element
                    const targetElement = codeElement.closest('pre') || codeElement;

                    // Create a placeholder div (invisible but marks the insertion point)
                    const placeholder = document.createElement('div');
                    placeholder.className = 'ember-code-placeholder';
                    placeholder.style.cssText = `
                        height: 0;
                        margin: 0;
                        padding: 0;
                        visibility: hidden;
                    `;

                    // Replace the code block with the placeholder
                    targetElement.parentNode.insertBefore(placeholder, targetElement);
                    targetElement.style.display = 'none';

                    console.log('[Ember Universal] Hidden original code block');

                    // Return the placeholder as insertion point
                    return placeholder;
                }
            }
        } catch (error) {
            console.warn('[Ember Universal] Could not hide original code block:', error);
        }

        return null;
    }

    /**
     * Check if HTML code is a full document
     */
    isFullHtmlDocument(htmlCode) {
        const trimmed = htmlCode.trim();
        return trimmed.includes('<!DOCTYPE html>') ||
               (trimmed.includes('<html') && trimmed.includes('</html>'));
    }

    /**
     * Render full HTML document directly in iframe
     */
    async renderFullHtmlDocument(messageId, messageElement, htmlContent, insertionPoint = null) {
        const frameId = `ember-html-${messageId}-${Date.now()}`;
        const iframe = document.createElement('iframe');
        iframe.className = 'ember-iframe';
        iframe.sandbox = 'allow-scripts allow-same-origin';
        iframe.dataset.frameId = frameId;
        iframe.style.cssText = 'width: 100%; border: none; display: block; overflow: hidden; min-height: 450px; height: 450px;';

        const container = document.createElement('div');
        container.className = 'ember-html-document-container';
        container.style.cssText = `
            border: 1px solid var(--SmartThemeBorderColor, #ddd);
            border-radius: 8px;
            margin: 10px 0;
            overflow: hidden;
            background: transparent;
        `;

        // Create blob URL for the HTML content
        iframe.src = URL.createObjectURL(new Blob([htmlContent], { type: 'text/html' }));

        container.appendChild(iframe);

        // Insert at the correct position
        if (insertionPoint && insertionPoint.parentNode) {
            insertionPoint.parentNode.insertBefore(container, insertionPoint.nextSibling);
        } else {
            messageElement.appendChild(container);
        }

        // Set up resize handling with better height detection
        iframe.onload = () => {
            try {
                // Try to get the content height
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    // Wait a bit for content to render
                    setTimeout(() => {
                        const height = Math.max(
                            iframeDoc.documentElement.scrollHeight,
                            iframeDoc.body.scrollHeight,
                            iframeDoc.documentElement.offsetHeight,
                            iframeDoc.body.offsetHeight,
                            450 // Minimum height for calculator
                        );
                        const finalHeight = Math.min(height + 40, 800); // Increased max height
                        iframe.style.height = finalHeight + 'px';
                        console.log(`[Ember Universal] Set iframe height to ${finalHeight}px`);
                    }, 100);
                }
            } catch (e) {
                // Cross-origin or other access issues - use larger default height
                iframe.style.height = '500px';
                console.log('[Ember Universal] Using default height due to access restriction');
            }
        };

        this.activeRenders.set(messageId, {
            type: 'html-document',
            container,
            iframe,
            frameId
        });

        return true;
    }

    /**
     * Render pure HTML content
     */
    async renderPureHtml(messageId, messageElement, content) {
        const container = document.createElement('div');
        container.className = 'ember-html-container';
        container.style.cssText = `
            border: 1px solid var(--SmartThemeBorderColor, #ddd);
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            background: transparent;
            overflow: auto;
        `;

        container.innerHTML = content;

        // Make interactive elements work
        this.makeInteractive(container);

        messageElement.appendChild(container);
        this.activeRenders.set(messageId, { type: 'html', container });

        return true;
    }

    /**
     * Render content in universal sandbox
     */
    async renderInSandbox(messageId, messageElement, content) {
        const { iframe, frameId } = await this.createUniversalSandbox(content, messageId);

        const container = document.createElement('div');
        container.className = 'ember-sandbox-container';
        container.style.cssText = `
            border: 1px solid var(--SmartThemeBorderColor, #ddd);
            border-radius: 8px;
            margin: 10px 0;
            overflow: hidden;
            background: transparent;
        `;

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ember-loading';
        loadingDiv.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--SmartThemeEmColor, #666);">
                <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i>
                Executing code...
            </div>
        `;

        container.appendChild(loadingDiv);
        container.appendChild(iframe);
        iframe.style.display = 'none';

        messageElement.appendChild(container);

        this.activeRenders.set(messageId, {
            type: 'sandbox',
            container,
            iframe,
            frameId,
            loading: loadingDiv
        });

        return true;
    }

    /**
     * Make HTML elements interactive
     */
    makeInteractive(container) {
        const buttons = container.querySelectorAll('button');
        const inputs = container.querySelectorAll('input, select, textarea');

        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const text = button.textContent.trim();
                console.log(`[Ember Universal] Button clicked: ${text}`);

                // Auto-trigger conversation continuation
                if (window.SillyTavern?.sendMessageAsUser && window.SillyTavern?.Generate) {
                    window.SillyTavern.sendMessageAsUser(text).then(() => {
                        window.SillyTavern.Generate('normal');
                    });
                }
            });
        });

        inputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const label = input.previousElementSibling?.textContent ||
                             input.placeholder ||
                             input.name ||
                             'Input';
                const value = input.value;

                if (value.trim()) {
                    console.log(`[Ember Universal] Input changed: ${label} = ${value}`);

                    if (window.SillyTavern?.sendMessageAsUser && window.SillyTavern?.Generate) {
                        window.SillyTavern.sendMessageAsUser(`${label}: ${value}`).then(() => {
                            window.SillyTavern.Generate('normal');
                        });
                    }
                }
            });
        });
    }

    /**
     * Handle messages from sandbox iframes
     */
    handleMessage(event) {
        if (!event.data?.type?.startsWith('ember-')) return;

        const { type, frameId, ...data } = event.data;
        const render = Array.from(this.activeRenders.values())
            .find(r => r.frameId === frameId);

        if (!render) return;

        switch (type) {
            case 'ember-success':
                if (render.loading) render.loading.style.display = 'none';
                if (render.iframe) render.iframe.style.display = 'block';
                break;

            case 'ember-error':
                if (render.loading) {
                    render.loading.innerHTML = `
                        <div style="padding: 15px; color: var(--text-color-error, #dc3545);">
                            <i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i>
                            <strong>Execution Error:</strong> ${data.message}
                        </div>
                    `;
                }
                break;

            case 'ember-resize':
                if (render.iframe && data.height > 0) {
                    const newHeight = Math.min(data.height + 20, 600);
                    render.iframe.style.height = newHeight + 'px';
                }
                break;

            case 'ember-auto-context':
                // Auto-inject context from user interactions
                console.log(`[Ember Universal] Auto-context: ${data.content}`);
                if (window.SillyTavern?.sendMessageAsUser && window.SillyTavern?.Generate) {
                    window.SillyTavern.sendMessageAsUser(data.content).then(() => {
                        window.SillyTavern.Generate('normal');
                    });
                }
                break;
        }
    }

    /**
     * Show error message
     */
    showError(messageElement, error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'ember-error';
        errorDiv.innerHTML = `
            <div style="
                color: var(--text-color-error, #dc3545);
                background: rgba(220, 53, 69, 0.1);
                border: 1px solid rgba(220, 53, 69, 0.3);
                border-radius: 5px;
                padding: 15px;
                margin: 10px 0;
            ">
                <i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px;"></i>
                <strong>Render Error:</strong> ${error.message}
            </div>
        `;
        messageElement.appendChild(errorDiv);
    }

    /**
     * Cleanup render for message
     */
    /**
     * Setup AI response parsing for asset pack state updates
     */
    setupAIResponseParsing() {
        // Add parser for asset pack state updates
        this.aiResponseParsers.add((response, messageId) => {
            // Check all active asset packs for this message
            const assetPacks = this.messageAssetPacks.get(messageId) || [];

            for (const packInstance of assetPacks) {
                const updates = packInstance.parseAIResponse(response);
                if (Object.keys(updates).length > 0) {
                    console.log(`[Universal] Parsed AI state updates for pack ${packInstance.id}:`, updates);
                }
            }
        });

        console.log('[Universal] AI response parsing setup complete');
    }

    /**
     * Register an asset pack with the renderer
     */
    registerAssetPack(assetPackData) {
        const assetPack = new AssetPack(assetPackData);
        this.registeredAssetPacks.set(assetPack.id, assetPack);
        console.log(`[Universal] Registered asset pack: ${assetPack.id}`);
        return assetPack;
    }

    /**
     * Create an AssetPack instance without registering it
     */
    async createAssetPackInstance(packData) {
        try {
            const assetPack = new AssetPack(packData);
            console.log(`[Universal] Created asset pack instance: ${assetPack.id}`);
            return assetPack;
        } catch (error) {
            console.error('[Universal] Failed to create asset pack instance:', error);
            throw error;
        }
    }

    /**
     * Render asset pack in message
     */
    async renderAssetPack(packId, messageId, messageElement, position = null) {
        const assetPack = this.registeredAssetPacks.get(packId);
        if (!assetPack) {
            console.warn(`[Universal] Asset pack not found: ${packId}`);
            return false;
        }

        try {
            const instanceId = await assetPack.render(messageId, messageElement, position);

            // Track this asset pack for the message
            if (!this.messageAssetPacks.has(messageId)) {
                this.messageAssetPacks.set(messageId, []);
            }
            this.messageAssetPacks.get(messageId).push(assetPack);

            console.log(`[Universal] Rendered asset pack ${packId} in message ${messageId}`);
            return instanceId;
        } catch (error) {
            console.error(`[Universal] Failed to render asset pack ${packId}:`, error);
            return false;
        }
    }

    /**
     * Parse AI response for state updates across all active asset packs
     */
    parseAIResponse(response, messageId) {
        for (const parser of this.aiResponseParsers) {
            try {
                parser(response, messageId);
            } catch (error) {
                console.error('[Universal] AI response parser error:', error);
            }
        }

        // After parsing, clean the message
        setTimeout(() => {
            this.processAndCleanAIResponse(messageId);
        }, 100); // Small delay to ensure parsing is complete
    }

    /**
     * Process and clean AI response after parsing state updates
     */
    async processAndCleanAIResponse(messageId) {
        try {
            // Get message element and context data
            const messageElement = document.querySelector(`.mes[mesid="${messageId}"] .mes_text`);
            const context = window.SillyTavern?.getContext?.() || window.getContext?.();

            if (!messageElement || !context?.chat?.[messageId]) {
                console.log(`[Universal] Cannot find message ${messageId} for cleaning`);
                return;
            }

            const messageData = context.chat[messageId];
            if (messageData.is_user) return; // Only process AI responses

            // Check if already cleaned to avoid reprocessing
            if (messageElement.dataset.ember2Cleaned) {
                return;
            }

            let originalText = messageData.mes;
            let cleanedText = originalText;
            let hasStateUpdates = false;

            // Process all active asset packs to remove their STATE_UPDATE tags
            for (const [packId, assetPackInstance] of this.activeAssetPacks) {
                if (assetPackInstance.chatInjection?.stateUpdateFormat) {
                    const beforeCleaning = cleanedText;
                    cleanedText = assetPackInstance.removeStateUpdateTags(cleanedText);

                    if (beforeCleaning !== cleanedText) {
                        hasStateUpdates = true;
                        console.log(`[Universal] Cleaned STATE_UPDATE tags for pack: ${packId}`);
                    }
                }
            }

            // Fallback: Clean common STATE_UPDATE formats even if no active packs match
            if (!hasStateUpdates && this.activeAssetPacks.size > 0) {
                const beforeGenericCleaning = cleanedText;
                // Import AssetPack dynamically for static method access
                const { AssetPack } = await import('./AssetPack.js');
                cleanedText = AssetPack.removeAllStateUpdateTags(cleanedText);

                if (beforeGenericCleaning !== cleanedText) {
                    hasStateUpdates = true;
                    console.log(`[Universal] Cleaned STATE_UPDATE tags using generic patterns`);
                }
            }

            // Update both display and chat context if tags were removed
            if (hasStateUpdates && cleanedText !== originalText) {
                // Update display
                messageElement.innerHTML = this.renderMessageContent(cleanedText);

                // Update chat context
                messageData.mes = cleanedText;

                // Mark message as cleaned to avoid reprocessing
                messageElement.dataset.ember2Cleaned = Date.now().toString();

                console.log(`[Universal] Message ${messageId} cleaned and updated in both display and context`);
            }

        } catch (error) {
            console.error(`[Universal] Failed to clean message ${messageId}:`, error);
        }
    }

    /**
     * Render message content with proper formatting
     */
    renderMessageContent(text) {
        // Basic markdown-style formatting that SillyTavern uses
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    /**
     * Enhanced renderContent that checks for asset pack triggers
     */
    async renderContentWithAssetPacks(messageId, targetElement, content) {
        // First, try regular content rendering
        const regularRender = await this.renderContent(messageId, targetElement, content);

        // Check if content contains asset pack triggers
        const assetPackTriggers = this.detectAssetPackTriggers(content);

        for (const trigger of assetPackTriggers) {
            await this.renderAssetPack(trigger.packId, messageId, targetElement, trigger.position);
        }

        return regularRender || assetPackTriggers.length > 0;
    }

    /**
     * Detect asset pack triggers in content
     */
    detectAssetPackTriggers(content) {
        const triggers = [];

        // Look for asset pack activation patterns
        // Examples: [ASSET_PACK:dating-sim], [PACK:inventory:right], etc.
        const packPattern = /\[(?:ASSET_)?PACK:([^:]+)(?::([^:\]]+))?\]/gi;
        let match;

        while ((match = packPattern.exec(content)) !== null) {
            const packId = match[1];
            const position = match[2] || null;

            if (this.registeredAssetPacks.has(packId)) {
                triggers.push({ packId, position });
            }
        }

        return triggers;
    }

    /**
     * Get asset pack state for chat injection
     */
    getAssetPackStateForInjection(messageId) {
        const assetPacks = this.messageAssetPacks.get(messageId) || [];
        const stateData = {};

        for (const pack of assetPacks) {
            const prompt = pack.generateCurrentPrompt();
            if (prompt) {
                stateData[pack.id] = prompt;
            }
        }

        return stateData;
    }

    cleanup(messageId) {
        const render = this.activeRenders.get(messageId);
        if (render) {
            if (render.container?.parentElement) {
                render.container.parentElement.removeChild(render.container);
            }
            this.activeRenders.delete(messageId);
        }

        // Cleanup asset pack instances for this message
        const assetPacks = this.messageAssetPacks.get(messageId) || [];
        for (const pack of assetPacks) {
            const instances = Array.from(pack.activeInstances.keys()).filter(id =>
                pack.activeInstances.get(id).messageId === messageId
            );
            for (const instanceId of instances) {
                pack.cleanup(instanceId);
            }
        }
        this.messageAssetPacks.delete(messageId);
    }
}