declare const require: (path: string) => unknown;
console.log("entry ran");
require("../tools/effect.ts");
export {};
