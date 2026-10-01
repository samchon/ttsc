declare const require: (id: string) => { value: string };
console.log(require("rawpkg").value);
export {};
