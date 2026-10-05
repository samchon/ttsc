declare const console: { log(value: unknown): void };
const wrong: number = "wrong";
console.log("INVALID_PRELOAD_RAN:" + wrong);
export {};
