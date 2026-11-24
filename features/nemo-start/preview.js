import { DOMPurify, showdown } from '../../../../../../lib.js';
import * as chatUtilities from '../../../../../chats.js';

const markdown = new showdown.Converter({ simpleLineBreaks: true, strikethrough: true });

function getImageUrl(src, allowExternal) {
    if (!src) return null;

    try {
        const url = new URL(src, document.baseURI);
        if (url.protocol === 'data:') return /^data:image\//i.test(url.href) ? url.href : null;
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        return url.origin === window.location.origin || allowExternal ? url.href : null;
    } catch {
        return null;
    }
}

export function renderSwipePreview(text) {
    const fragment = DOMPurify.sanitize(markdown.makeHtml(text), {
        ALLOWED_TAGS: [
            'p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'mark', 'q', 'blockquote',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'pre', 'code', 'img',
        ],
        ALLOWED_ATTR: ['src', 'alt', 'title', 'start'],
        ALLOW_ARIA_ATTR: false,
        ALLOW_DATA_ATTR: false,
        RETURN_DOM_FRAGMENT: true,
    });

    const allowExternal = chatUtilities.isExternalMediaAllowed?.() === true;
    for (const image of fragment.querySelectorAll('img')) {
        const url = getImageUrl(image.getAttribute('src'), allowExternal);
        if (!url) {
            image.replaceWith(image.alt || 'Image unavailable');
            continue;
        }

        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        image.src = url;
    }

    return fragment;
}
