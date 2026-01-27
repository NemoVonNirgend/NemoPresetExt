/**
 * Navigator wrapper for vanilla JS integration
 * This module provides a class-based API that mirrors the original PromptNavigator
 * but uses React under the hood
 */

import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { NavigatorView } from './components/navigator';

// Import ST popup API
declare const callGenericPopup: (content: any, type: string, title?: string, options?: any) => Promise<any>;
declare const POPUP_TYPE: { INPUT: string; CONFIRM: string; DISPLAY: string };

export class ReactPromptNavigator {
    private navigatorElement: HTMLDivElement | null = null;
    private root: Root | null = null;
    private closeCallback: (() => void) | null = null;

    async init(): Promise<void> {
        // Create container element
        this.navigatorElement = document.createElement('div');
        this.navigatorElement.className = 'nemo-prompt-navigator-wrapper';
    }

    async open(): Promise<void> {
        await this.init();

        if (!this.navigatorElement) return;

        // Mount React component
        this.root = createRoot(this.navigatorElement);
        this.root.render(
            React.createElement(NavigatorView, {
                onClose: () => this.close()
            })
        );

        // Show in ST popup
        callGenericPopup(this.navigatorElement, POPUP_TYPE.DISPLAY, 'Prompt Navigator', {
            wide: true,
            large: true,
            addCloseButton: true,
            onclose: () => this.cleanup()
        });
    }

    close(): void {
        // Find and click the close button
        const closeButton = this.navigatorElement?.closest('.popup_outer, dialog.popup')
            ?.querySelector('.popup-button-close');
        if (closeButton) {
            (closeButton as HTMLElement).click();
        }
    }

    cleanup(): void {
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
        this.navigatorElement = null;
        this.closeCallback?.();
    }

    onClose(callback: () => void): void {
        this.closeCallback = callback;
    }
}

// Default export for easy import
export default ReactPromptNavigator;

// Factory function for vanilla JS
export function createPromptNavigator(): ReactPromptNavigator {
    return new ReactPromptNavigator();
}
