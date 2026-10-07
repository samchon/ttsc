declare const process: { argv: string[]; cwd(): string; on(name: string, listener: (error: Error) => void): void };
declare const console: { log(value: unknown): void };
declare function setTimeout(callback: () => void, duration: number): unknown;
process.on("uncaughtException", (error) => console.log("handled: " + error.message));
console.log("TTSC_HANDLED_PRELOADS:" + JSON.stringify({ preload: (globalThis as Record<string, unknown>).__ttsxPreload, scoped: (globalThis as Record<string, unknown>).__ttsxScopedPreload, subpath: (globalThis as Record<string, unknown>).__ttsxSubpathPreload, argv: process.argv.slice(2), cwd: process.cwd() }));
setTimeout(() => { throw new Error("boom"); }, 0);
setTimeout(() => console.log("still alive"), 20);
export {};
