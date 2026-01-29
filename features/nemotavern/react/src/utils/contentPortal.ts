/**
 * Utility for moving ST drawer content into NemoTavern panels
 */

interface PortalState {
    originalParent: HTMLElement;
    originalDisplay: string;
    originalStyles: Partial<CSSStyleDeclaration>;
}

const portalStates = new Map<string, PortalState>();

/**
 * Move drawer content into a panel
 */
export function moveContentToPanel(drawerId: string, targetContainer: HTMLElement): boolean {
    const drawer = document.getElementById(drawerId);
    if (!drawer) {
        console.warn(`[NemoTavern] Drawer not found: ${drawerId}`);
        return false;
    }

    const drawerContent = drawer.querySelector('.drawer-content') as HTMLElement;
    if (!drawerContent) {
        console.warn(`[NemoTavern] Drawer content not found in: ${drawerId}`);
        return false;
    }

    // Store original state
    portalStates.set(drawerId, {
        originalParent: drawer,
        originalDisplay: drawerContent.style.display,
        originalStyles: {
            position: drawerContent.style.position,
            width: drawerContent.style.width,
            height: drawerContent.style.height,
            maxHeight: drawerContent.style.maxHeight,
            transform: drawerContent.style.transform,
            opacity: drawerContent.style.opacity,
            visibility: drawerContent.style.visibility
        }
    });

    // Move content
    targetContainer.appendChild(drawerContent);

    // Apply panel styles
    drawerContent.style.display = 'block';
    drawerContent.style.position = 'static';
    drawerContent.style.width = '100%';
    drawerContent.style.height = 'auto';
    drawerContent.style.maxHeight = 'none';
    drawerContent.style.transform = 'none';
    drawerContent.style.opacity = '1';
    drawerContent.style.visibility = 'visible';

    // Mark drawer as portal source
    drawer.classList.add('nemo-portal-source');

    console.log(`[NemoTavern] Moved content from ${drawerId} to panel`);
    return true;
}

/**
 * Return drawer content to original location
 */
export function returnContentToDrawer(drawerId: string): boolean {
    const state = portalStates.get(drawerId);
    if (!state) {
        return false;
    }

    const drawerContent = document.querySelector(`[data-original-drawer="${drawerId}"]`) as HTMLElement ||
        state.originalParent.ownerDocument.querySelector(`.nemo-panel-body .drawer-content`);

    if (!drawerContent) {
        console.warn(`[NemoTavern] Could not find content to return for: ${drawerId}`);
        return false;
    }

    // Return to original parent
    state.originalParent.appendChild(drawerContent);

    // Restore original styles
    drawerContent.style.display = state.originalDisplay;
    Object.entries(state.originalStyles).forEach(([key, value]) => {
        if (value !== undefined) {
            (drawerContent.style as any)[key] = value;
        }
    });

    // Remove portal marker
    state.originalParent.classList.remove('nemo-portal-source');

    // Clean up state
    portalStates.delete(drawerId);

    console.log(`[NemoTavern] Returned content to ${drawerId}`);
    return true;
}

/**
 * Return all portal content to original locations
 */
export function returnAllContent(): void {
    portalStates.forEach((_, drawerId) => {
        returnContentToDrawer(drawerId);
    });
}

export default { moveContentToPanel, returnContentToDrawer, returnAllContent };
