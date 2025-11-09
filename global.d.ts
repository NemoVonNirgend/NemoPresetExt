interface Window {
    getWorldEntry: (name: string, data: any, entry: any) => Promise<JQuery<HTMLElement>>;
    displayWorldEntries: (name: string, data: any, ...args: any[]) => Promise<void>;
    nemolore_intercept_messages: (messages: any[]) => Promise<boolean>;
}

declare class Sortable {
    constructor(element: HTMLElement, options: any);
    destroy(): void;
}

interface JQuery {
    pagination(options?: any): JQuery<HTMLElement>;
    pagination(method: 'getCurrentPageNum'): number;
    pagination(method: string, options?: any): JQuery<HTMLElement>;
}