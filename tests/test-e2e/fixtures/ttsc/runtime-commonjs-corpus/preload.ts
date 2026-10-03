const tag: string = "preloaded";
(globalThis as { tag?: string }).tag = tag;
export {};
