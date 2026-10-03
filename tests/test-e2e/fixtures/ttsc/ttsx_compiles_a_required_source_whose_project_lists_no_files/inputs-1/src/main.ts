declare const require: (path: string) => { decoratorArguments: number };
const { decoratorArguments } = require("../tools/probe.ts");
console.log("arguments=" + decoratorArguments);
export {};
