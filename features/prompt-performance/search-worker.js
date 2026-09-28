import { BodySearchIndex } from './search-engine.js';
const index = new BodySearchIndex();
self.onmessage = ({ data }) => {
    try { self.postMessage({ request: data.request, result: index.handle(data) }); }
    catch (error) { self.postMessage({ request: data.request, error: String(error.message || error) }); }
};
