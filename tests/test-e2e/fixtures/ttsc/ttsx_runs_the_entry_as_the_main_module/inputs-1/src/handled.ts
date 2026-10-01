declare const process: { on(event: string, listener: (error: Error) => void): void };
declare function setTimeout(callback: () => void, ms: number): unknown;
process.on("uncaughtException", (error) => console.log("handled: " + error.message));
setTimeout(() => console.log("still alive"), 10);
throw new Error("boom");
export {};
