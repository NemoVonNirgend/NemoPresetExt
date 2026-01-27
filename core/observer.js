// Auto-generated from TypeScript - do not edit directly
import { CONSTANTS } from "./constants.js";
class ObserverRegistry {
  observers = /* @__PURE__ */ new Map();
  counter = 0;
  /**
   * Register a new observer
   */
  register(name, observer, target) {
    const id = name || `observer_${++this.counter}`;
    if (this.observers.has(id)) {
      this.disconnect(id);
    }
    this.observers.set(id, {
      observer,
      target,
      name: id,
      createdAt: Date.now()
    });
    return id;
  }
  /**
   * Disconnect and remove an observer by ID
   */
  disconnect(id) {
    const entry = this.observers.get(id);
    if (entry) {
      entry.observer.disconnect();
      this.observers.delete(id);
      return true;
    }
    return false;
  }
  /**
   * Disconnect all observers
   */
  disconnectAll() {
    for (const [id] of this.observers) {
      this.disconnect(id);
    }
  }
  /**
   * Get count of active observers
   */
  get size() {
    return this.observers.size;
  }
  /**
   * Check if an observer exists
   */
  has(id) {
    return this.observers.has(id);
  }
  /**
   * Get all observer IDs
   */
  getIds() {
    return Array.from(this.observers.keys());
  }
}
const observerRegistry = new ObserverRegistry();
function waitForElement(selector, options = {}) {
  const {
    timeout = CONSTANTS.TIMEOUTS.NETWORK_REQUEST,
    interval = CONSTANTS.TIMEOUTS.PRESET_LOAD_POLL_INTERVAL,
    root = document
  } = options;
  return new Promise((resolve, reject) => {
    const existing = root.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const startTime = Date.now();
    const checkElement = () => {
      const element = root.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }
      if (Date.now() - startTime >= timeout) {
        reject(new Error(`Timeout waiting for element: ${selector}`));
        return;
      }
      setTimeout(checkElement, interval);
    };
    checkElement();
  });
}
function waitForElementObserver(selector, options = {}) {
  const {
    timeout = CONSTANTS.TIMEOUTS.NETWORK_REQUEST,
    root = document
  } = options;
  return new Promise((resolve, reject) => {
    const existing = root.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    let timeoutId;
    const observerTarget = root instanceof Document ? root.body : root;
    const observer = new MutationObserver(() => {
      const element = root.querySelector(selector);
      if (element) {
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve(element);
      }
    });
    observer.observe(observerTarget, { childList: true, subtree: true });
    timeoutId = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
function observeElement(name, target, callback, options = {}) {
  const { once = false, debounce: debounceDelay, ...observerOptions } = options;
  let wrappedCallback = callback;
  if (debounceDelay && debounceDelay > 0) {
    const debouncedFn = debounce(
      (mutations, obs) => callback(mutations, obs),
      debounceDelay
    );
    wrappedCallback = debouncedFn;
  }
  if (once) {
    const originalCallback = wrappedCallback;
    wrappedCallback = (mutations, obs) => {
      obs.disconnect();
      observerRegistry.disconnect(name);
      originalCallback(mutations, obs);
    };
  }
  const observer = new MutationObserver(wrappedCallback);
  const finalOptions = {
    childList: true,
    subtree: true,
    ...observerOptions
  };
  observer.observe(target, finalOptions);
  return observerRegistry.register(name, observer, target);
}
function observeOnce(selector, callback, root = document) {
  const existing = root.querySelector(selector);
  if (existing) {
    callback(existing);
    return "";
  }
  const observerTarget = root instanceof Document ? root.body : root;
  const name = `once_${selector}_${Date.now()}`;
  return observeElement(
    name,
    observerTarget,
    (mutations, obs) => {
      const element = root.querySelector(selector);
      if (element) {
        obs.disconnect();
        observerRegistry.disconnect(name);
        callback(element);
      }
    },
    { childList: true, subtree: true, once: false }
  );
}
function observeAttributes(name, target, callback, attributes) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes" && mutation.attributeName) {
        const newValue = mutation.target.getAttribute(mutation.attributeName);
        callback(mutation.attributeName, newValue, mutation.oldValue);
      }
    }
  });
  const options = {
    attributes: true,
    attributeOldValue: true
  };
  if (attributes && attributes.length > 0) {
    options.attributeFilter = attributes;
  }
  observer.observe(target, options);
  return observerRegistry.register(name, observer, target);
}
function observeChildren(name, target, callback, options = {}) {
  const { deep = false, debounce: debounceDelay = 0 } = options;
  return observeElement(
    name,
    target,
    (mutations) => {
      const added = [];
      const removed = [];
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          added.push(...Array.from(mutation.addedNodes));
          removed.push(...Array.from(mutation.removedNodes));
        }
      }
      if (added.length > 0 || removed.length > 0) {
        callback(added, removed);
      }
    },
    { childList: true, subtree: deep, debounce: debounceDelay }
  );
}
function disconnectObserver(id) {
  return observerRegistry.disconnect(id);
}
function disconnectAllObservers() {
  observerRegistry.disconnectAll();
}
function getObserverCount() {
  return observerRegistry.size;
}
var observer_default = {
  waitForElement,
  waitForElementObserver,
  observeElement,
  observeOnce,
  observeAttributes,
  observeChildren,
  disconnectObserver,
  disconnectAllObservers,
  getObserverCount,
  registry: observerRegistry
};
export {
  observer_default as default,
  disconnectAllObservers,
  disconnectObserver,
  getObserverCount,
  observeAttributes,
  observeChildren,
  observeElement,
  observeOnce,
  observerRegistry,
  waitForElement,
  waitForElementObserver
};
