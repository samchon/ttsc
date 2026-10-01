declare const require: (id: string) => { value: string };
console.log(require("../dep/src/inside.ts").value);
console.log(require("../dep/extra.ts").value);
export {};
