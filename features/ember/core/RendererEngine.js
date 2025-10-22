// SPDX-License-Identifier: AGPL-3.0-or-later
// Ember 2.0 - Renderer Engine Core

export class RendererEngine {
    constructor() {
        this.renderers = new Map();
        this.activeIframes = new Map();
        this.messageObservers = new Map();
        this.builtInLibraries = [
            { alias: 'd3', file: 'd3.v7.min.js' },
            { alias: 'three', file: 'three.r128.min.js' },
            { alias: 'p5', file: 'p5.v1.4.0.min.js' },
            { alias: 'anime', file: 'anime.v3.2.1.min.js' },
            { alias: 'chartjs', file: 'chart.umd.js' },
            { alias: 'matter', file: 'matter.v0.18.0.min.js' }
        ];
    }

    /**
     * Register a content renderer
     */
    registerRenderer(type, handler) {
        this.renderers.set(type, handler);
        console.log(`[Ember Renderer] Registered renderer: ${type}`);
    }

    /**
     * Render content in a message element
     */
    async renderContent(messageId, messageElement, content, options = {}) {
        const contentType = this.detectContentType(content);
        const renderer = this.renderers.get(contentType);

        if (!renderer) {
            console.warn(`[Ember Renderer] No renderer found for type: ${contentType}`);
            return false;
        }

        console.log(`[Ember Renderer] Rendering ${contentType} content for message ${messageId}`);

        try {
            const result = await renderer.render(messageId, messageElement, content, options);

            if (result.iframe) {
                this.trackIframe(messageId, result.iframe);
            }

            return result;
        } catch (error) {
            console.error(`[Ember Renderer] Error rendering ${contentType}:`, error);
            this.displayError(messageElement, error, contentType);
            return false;
        }
    }

    /**
     * Detect content type from various indicators
     */
    detectContentType(content) {
        // Asset pack detection
        if (content.includes('//@name ') && content.includes('//@export ')) {
            return 'asset-pack';
        }

        // JavaScript detection
        if (this.isJavaScript(content)) {
            return 'javascript';
        }

        // HTML detection
        if (this.isSignificantHtml(content)) {
            return 'html';
        }

        // Interactive form detection
        if (this.hasInteractiveElements(content)) {
            return 'interactive-form';
        }

        return 'unknown';
    }

    /**
     * Enhanced JavaScript detection
     */
    isJavaScript(content) {
        const jsPatterns = [
            /\b(const|let|var|function|class|if|else|for|while|return|new|this|try|catch|finally|async|await|export|import)\b/,
            /\b(document\.|window\.|\.getElementById|\.querySelector|\.createElement|\.appendChild|\.addEventListener)\b/,
            /\b(\.push|\.pop|\.map|\.filter|\.forEach|\.reduce|\.find|\.some|\.every|console\.log|JSON\.|Math\.)\b/,
            /=>\s*[\{\(]/,
            /[=!]==|&&|\|\||\.\.\.|\?\?|\?\./,
            /\/[^\/\n]+\/[gimuy]*/,
            /`[^`]*\$\{[^}]*\}[^`]*`/
        ];

        let score = 0;
        for (const pattern of jsPatterns) {
            if (pattern.test(content)) score++;
        }

        return score >= 2;
    }

    /**
     * HTML significance detection
     */
    isSignificantHtml(content) {
        const hasHtmlTags = /<[a-zA-Z][^>]*>/i.test(content);
        const hasCompleteElements = /<([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>[\s\S]*?<\/\1>/i.test(content);
        const hasScriptTags = /<script\b[^>]*>[\s\S]*?<\/script>/i.test(content);

        return hasCompleteElements || hasScriptTags || (hasHtmlTags && content.split('<').length > 3);
    }

    /**
     * Interactive elements detection
     */
    hasInteractiveElements(content) {
        return /<(button|input|select|textarea|form)\b[^>]*>/i.test(content);
    }

    /**
     * Create sandboxed iframe for safe execution
     */
    createSandboxedIframe(content, libraries = [], frameId) {
        const iframe = document.createElement('iframe');
        iframe.className = 'ember-iframe';
        iframe.sandbox = 'allow-scripts allow-same-origin';
        iframe.dataset.frameId = frameId;
        iframe.style.cssText = 'width: 100%; border: none; display: block; overflow: hidden; max-height: 600px; min-height: 200px;';

        const iframeContent = this.buildIframeContent(content, libraries, frameId);
        iframe.src = URL.createObjectURL(new Blob([iframeContent], { type: 'text/html' }));

        return iframe;
    }

    /**
     * Build complete iframe content
     */
    buildIframeContent(content, libraries, frameId) {
        const safeContent = JSON.stringify(content);
        const libraryScripts = JSON.stringify(libraries);

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        html, body {
            font-family: var(--mainFontFamily, sans-serif);
            color: var(--text-color, #000);
            background-color: transparent;
            margin: 0;
            padding: 8px;
            overflow: auto;
            max-height: 600px;
            box-sizing: border-box;
        }
        #root {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
            overflow: auto;
            max-height: 580px;
        }
        input, button, textarea, select {
            max-width: 100%;
            box-sizing: border-box;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        (function() {
            const frameId = "${frameId}";
            const content = ${safeContent};
            const libraries = ${libraryScripts};

            // Message passing setup
            const postMessage = (type, data) => {
                window.parent.postMessage({
                    type: 'ember-' + type,
                    frameId: frameId,
                    ...data
                }, '*');
            };

            // Error handling
            window.onerror = (msg, url, line, col, error) => {
                postMessage('error', {
                    message: error ? error.stack || error.message : msg
                });
                return true;
            };

            // Load libraries
            const loadLibraries = async () => {
                for (const libCode of libraries) {
                    try {
                        const script = document.createElement('script');
                        script.textContent = libCode;
                        document.head.appendChild(script);
                    } catch (error) {
                        console.error('Failed to load library:', error);
                    }
                }
            };

            // Smart DOM helpers
            const rootElement = document.getElementById('root');
            const createMissingElement = (id, type = 'div') => {
                let element = document.createElement(type);
                element.id = id;
                rootElement.appendChild(element);
                return element;
            };

            // Override getElementById to create missing elements
            const originalGetElementById = document.getElementById;
            document.getElementById = function(id) {
                const element = originalGetElementById.call(document, id);
                if (!element && id !== 'root') {
                    return createMissingElement(id);
                }
                return element;
            };

            // Ember API
            window.ember = {
                inject: (options) => {
                    postMessage('inject', { injection: options });
                },
                generate: (prompt) => {
                    postMessage('generate', { prompt });
                },
                log: (...args) => {
                    console.log('[Ember]', ...args);
                },
                error: (...args) => {
                    console.error('[Ember]', ...args);
                }
            };

            // Resize observer
            const resizeObserver = new ResizeObserver(() => {
                const height = Math.ceil(document.documentElement.scrollHeight);
                if (height > 0) {
                    postMessage('resize', { height });
                }
            });
            resizeObserver.observe(document.documentElement);

            // Success tracker
            let hasOutput = false;
            const successTracker = new MutationObserver(() => {
                if (rootElement.hasChildNodes() && !hasOutput) {
                    hasOutput = true;
                    postMessage('success', {});
                }
            });
            successTracker.observe(rootElement, { childList: true, subtree: true });

            // Timeout warning
            const timeout = setTimeout(() => {
                if (!hasOutput) {
                    postMessage('warning', {
                        message: 'Content produced no visual output within 7 seconds'
                    });
                }
            }, 7000);

            // Execute content
            const execute = async () => {
                try {
                    await loadLibraries();

                    // Execute the main content
                    const userCode = new Function('root', content);
                    await userCode(rootElement);

                    if (rootElement.hasChildNodes()) {
                        hasOutput = true;
                        postMessage('success', {});
                    }

                    clearTimeout(timeout);
                } catch (error) {
                    postMessage('error', {
                        message: error.stack || error.message
                    });
                }
            };

            execute();
        })();
    </script>
</body>
</html>`;
    }

    /**
     * Load built-in libraries
     */
    async loadBuiltInLibraries(libraryNames = []) {
        const libraryCodes = [];

        for (const libName of libraryNames) {
            const lib = this.builtInLibraries.find(l => l.alias === libName);
            if (!lib) {
                console.warn(`[Ember Renderer] Library ${libName} not found`);
                continue;
            }

            try {
                const response = await fetch(`/scripts/extensions/third-party/Ember/lib/${lib.file}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                const code = await response.text();
                libraryCodes.push(code);
                console.log(`[Ember Renderer] Loaded library: ${libName}`);
            } catch (error) {
                console.error(`[Ember Renderer] Failed to load library ${libName}:`, error);
            }
        }

        return libraryCodes;
    }

    /**
     * Track iframe for cleanup and communication
     */
    trackIframe(messageId, iframe) {
        const frameId = iframe.dataset.frameId;
        this.activeIframes.set(frameId, {
            messageId,
            iframe,
            createdAt: Date.now()
        });

        // Clean up when iframe is removed from DOM
        const observer = new MutationObserver(() => {
            if (!document.contains(iframe)) {
                this.activeIframes.delete(frameId);
                observer.disconnect();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    /**
     * Handle iframe messages
     */
    handleIframeMessage(event) {
        if (!event.data || !event.data.type?.startsWith('ember-')) return;

        const { type, frameId, ...data } = event.data;
        const iframe = this.activeIframes.get(frameId)?.iframe;

        if (!iframe) {
            console.warn(`[Ember Renderer] Received message for unknown iframe: ${frameId}`);
            return;
        }

        console.log(`[Ember Renderer] Iframe message: ${type}`);

        switch (type) {
            case 'ember-success':
                this.handleIframeSuccess(frameId, iframe);
                break;
            case 'ember-error':
                this.handleIframeError(frameId, iframe, data.message);
                break;
            case 'ember-resize':
                this.handleIframeResize(frameId, iframe, data.height);
                break;
            case 'ember-inject':
                this.handleContextInjection(frameId, data.injection);
                break;
            case 'ember-generate':
                this.handleGeneration(frameId, data.prompt);
                break;
        }
    }

    /**
     * Handle iframe success
     */
    handleIframeSuccess(frameId, iframe) {
        const container = iframe.parentElement;
        if (container) {
            const loader = container.querySelector('.ember-loading');
            if (loader) loader.style.display = 'none';
            iframe.style.display = 'block';
        }
    }

    /**
     * Handle iframe error
     */
    handleIframeError(frameId, iframe, errorMessage) {
        const container = iframe.parentElement;
        if (container) {
            const loader = container.querySelector('.ember-loading');
            if (loader) {
                loader.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span><b>Ember Error:</b> ${errorMessage}</span>`;
                loader.style.color = 'var(--text-color-error)';
            }
            iframe.style.display = 'none';
        }
    }

    /**
     * Handle iframe resize
     */
    handleIframeResize(frameId, iframe, height) {
        const maxHeight = 600;
        const newHeight = Math.min(height + 15, maxHeight);
        iframe.style.height = newHeight + 'px';
    }

    /**
     * Handle context injection from iframe
     */
    async handleContextInjection(frameId, injection) {
        if (window.ember?.assetPackSystem) {
            const iframeData = this.activeIframes.get(frameId);
            if (iframeData) {
                await window.ember.assetPackSystem.injectContext('iframe', injection);
            }
        }
    }

    /**
     * Handle generation trigger from iframe
     */
    async handleGeneration(frameId, prompt) {
        if (window.ember?.assetPackSystem) {
            const iframeData = this.activeIframes.get(frameId);
            if (iframeData) {
                await window.ember.assetPackSystem.triggerGeneration('iframe', prompt);
            }
        }
    }

    /**
     * Display error in message element
     */
    displayError(messageElement, error, contentType) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'ember-error';
        errorDiv.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span><b>Ember ${contentType} Error:</b> ${error.message}</span>
        `;
        errorDiv.style.cssText = 'color: var(--text-color-error); padding: 10px; margin: 5px 0;';
        messageElement.appendChild(errorDiv);
    }

    /**
     * Cleanup resources for a message
     */
    cleanup(messageId) {
        // Remove iframes for this message
        for (const [frameId, data] of this.activeIframes) {
            if (data.messageId === messageId) {
                if (data.iframe.parentElement) {
                    data.iframe.parentElement.removeChild(data.iframe);
                }
                this.activeIframes.delete(frameId);
            }
        }

        // Cleanup observers
        const observer = this.messageObservers.get(messageId);
        if (observer) {
            observer.disconnect();
            this.messageObservers.delete(messageId);
        }

        console.log(`[Ember Renderer] Cleaned up resources for message ${messageId}`);
    }

    /**
     * Initialize default renderers
     */
    initializeDefaultRenderers() {
        // JavaScript renderer
        this.registerRenderer('javascript', {
            render: async (messageId, messageElement, content, options) => {
                const frameId = `ember-js-${messageId}-${Date.now()}`;
                const libraries = options.libraries || ['d3', 'three', 'p5', 'anime', 'chartjs', 'matter'];

                const libraryCodes = await this.loadBuiltInLibraries(libraries);
                const iframe = this.createSandboxedIframe(content, libraryCodes, frameId);

                const container = this.createContainer(frameId, 'JavaScript');
                container.appendChild(iframe);
                messageElement.appendChild(container);

                return { iframe, container };
            }
        });

        // HTML renderer
        this.registerRenderer('html', {
            render: async (messageId, messageElement, content, options) => {
                const iframe = document.createElement('iframe');
                iframe.className = 'ember-html-iframe';
                iframe.sandbox = 'allow-scripts allow-same-origin';
                iframe.style.cssText = 'width: 100%; border: none; display: block; overflow: hidden;';

                const htmlContent = this.sanitizeHtml(content);
                iframe.src = URL.createObjectURL(new Blob([htmlContent], { type: 'text/html' }));

                const container = this.createContainer(`ember-html-${messageId}`, 'HTML');
                container.appendChild(iframe);
                messageElement.appendChild(container);

                return { iframe, container };
            }
        });

        // Asset pack renderer
        this.registerRenderer('asset-pack', {
            render: async (messageId, messageElement, content, options) => {
                if (!window.ember?.assetPackSystem) {
                    throw new Error('Asset Pack System not available');
                }

                const packData = {
                    content: content,
                    htmlContent: options.htmlContent || '',
                    cssContent: options.cssContent || '',
                    assets: options.assets || {}
                };

                const pack = await window.ember.assetPackSystem.registerPack(packData);
                const container = this.createContainer(`ember-pack-${messageId}`, pack.metadata.displayName || pack.id);

                const instance = await window.ember.assetPackSystem.loadPack(pack.id, container, options.args);

                messageElement.appendChild(container);
                return { container, pack, instance };
            }
        });

        console.log('[Ember Renderer] Default renderers initialized');
    }

    /**
     * Create container element
     */
    createContainer(frameId, title) {
        const container = document.createElement('div');
        container.className = 'ember-container';
        container.dataset.frameId = frameId;
        container.style.cssText = 'border: 1px solid var(--SmartThemeBorderColor); border-radius: 5px; margin: 10px 0; overflow: hidden;';

        // Add loading indicator
        const loader = document.createElement('div');
        loader.className = 'ember-loading';
        loader.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Loading ${title}...</span>`;
        loader.style.cssText = 'padding: 20px; text-align: center; opacity: 0.7;';
        container.appendChild(loader);

        return container;
    }

    /**
     * Basic HTML sanitization
     */
    sanitizeHtml(html) {
        // Basic sanitization - remove script tags from external sources
        return html.replace(/<script[^>]*src[^>]*>[\s\S]*?<\/script>/gi, '<!-- External script removed for security -->');
    }
}