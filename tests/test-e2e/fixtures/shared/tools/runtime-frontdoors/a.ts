declare const console: { log(value: unknown): void };
(globalThis as Record<string, unknown>).__ttsxPreload = "loaded";
console.log("PRELOAD a.ts");
export {};
