const tag: number = "mistyped";
(globalThis as { tag?: number }).tag = tag;
export {};
