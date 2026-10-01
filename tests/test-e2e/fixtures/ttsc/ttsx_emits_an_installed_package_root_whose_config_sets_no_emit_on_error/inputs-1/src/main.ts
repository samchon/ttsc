declare const require: (id: string) => { decoratorArguments: number };
console.log("arguments=" + require("strict-pkg").decoratorArguments);
export {};
