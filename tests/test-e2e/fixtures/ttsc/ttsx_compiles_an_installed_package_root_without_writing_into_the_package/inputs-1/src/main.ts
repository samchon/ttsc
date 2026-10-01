declare const require: (id: string) => { value: string };
console.log(require("root-pkg").value);
export {};
