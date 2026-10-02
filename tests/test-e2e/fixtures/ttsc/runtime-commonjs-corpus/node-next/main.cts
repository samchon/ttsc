const message: string = "cts-runner-ok";
console.log(message);

declare const require: (specifier: string) => unknown;
declare const process: { exitCode: number };
console.log("BEGIN:nested-star");
try { require("./nested-star.cjs"); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
console.log("END:nested-star");
export {};
