declare const process: { on(name: string, listener: (error: Error) => void): void };
declare const console: { log(value: unknown): void };
declare function setTimeout(callback: () => void, duration: number): unknown;
process.on("uncaughtException", (error) => console.log("handled: " + error.message));
setTimeout(() => { throw new Error("boom"); }, 0);
setTimeout(() => console.log("still alive"), 20);
export {};
