declare const require: (id: string) => { decoratorArguments: number };
console.log("arguments=" + require("legacy-pkg").decoratorArguments);
export {};
