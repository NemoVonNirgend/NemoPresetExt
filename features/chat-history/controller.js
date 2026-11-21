const TOP_THRESHOLD = 24;
const SCROLL_INTENT_MS = 500;
const TOUCH_THRESHOLD = 6;
const SHOW_MORE = ':scope > #show_more_messages';

export function attachHistoryScroll({ scroller, showMoreMessages, pageSize, onError }) {
    const view = scroller.ownerDocument.defaultView;
    const listeners = new AbortController();
    const passive = { passive: true, signal: listeners.signal };
    let touch = null;
    let intent = null;
    let frame = null;
    let loading = false;

    function cancelIntent() {
        intent = null;
        if (frame !== null) view.cancelAnimationFrame(frame);
        frame = null;
    }

    function schedule() {
        if (frame !== null || loading) return;
        frame = view.requestAnimationFrame(() => {
            frame = null;
            void loadAtTop().catch(onError);
        });
    }

    async function loadAtTop() {
        if (!intent || view.performance.now() >= intent.expires || scroller.scrollTop > TOP_THRESHOLD) return;
        if (scroller.querySelector(SHOW_MORE) !== intent.button) return;
        const anchor = scroller.querySelector(':scope > .mes[mesid]');
        const limit = pageSize();
        if (!anchor || !Number.isSafeInteger(limit) || limit < 1) return;

        const anchorTop = anchor.getBoundingClientRect().top;
        cancelIntent();
        loading = true;
        try {
            const inserted = showMoreMessages(limit);
            // SillyTavern prepends synchronously before awaiting its paging event.
            // Compensate for the insertion while the current message is still our anchor.
            if (anchor.parentElement === scroller) {
                scroller.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
            }
            await inserted;
        } finally {
            loading = false;
        }
    }

    function markUp(target) {
        if (loading) return;
        const button = scroller.querySelector(SHOW_MORE);
        if (!button) return;
        // Let a nested text editor or scrollable message block consume its own scroll.
        for (let node = target; node && node !== scroller; node = node.parentElement) {
            if (node.scrollTop > 0 && /^(auto|scroll|overlay)$/.test(view.getComputedStyle(node).overflowY)) {
                cancelIntent();
                return;
            }
        }
        intent = { button, expires: view.performance.now() + SCROLL_INTENT_MS };
        schedule();
    }

    scroller.addEventListener('wheel', event => {
        if (event.defaultPrevented || event.ctrlKey || event.shiftKey
            || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
        if (event.deltaY < 0) markUp(event.target);
        if (event.deltaY > 0) cancelIntent();
    }, passive);
    scroller.addEventListener('scroll', () => {
        if (intent && view.performance.now() < intent.expires) schedule();
    }, passive);
    scroller.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
            || event.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
        if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) markUp(event.target);
        if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) cancelIntent();
    }, { signal: listeners.signal });
    scroller.addEventListener('touchstart', event => {
        cancelIntent();
        const point = event.touches[0];
        touch = event.touches.length === 1 ? { x: point.clientX, y: point.clientY } : null;
    }, passive);
    scroller.addEventListener('touchmove', event => {
        if (!touch || event.touches.length !== 1) return;
        const { clientX: x, clientY: y } = event.touches[0];
        const dy = y - touch.y;
        const dx = x - touch.x;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < TOUCH_THRESHOLD) return;

        touch = { x, y };
        if (dy > Math.abs(dx)) markUp(event.target);
        else cancelIntent();
    }, passive);
    scroller.addEventListener('touchend', () => { touch = null; }, passive);
    scroller.addEventListener('touchcancel', () => {
        touch = null;
        cancelIntent();
    }, passive);
    scroller.addEventListener('click', cancelIntent, { capture: true, signal: listeners.signal });

    return () => {
        cancelIntent();
        listeners.abort();
    };
}
