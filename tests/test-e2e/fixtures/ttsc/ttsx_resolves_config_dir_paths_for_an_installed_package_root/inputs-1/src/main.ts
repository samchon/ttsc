declare const require: (id: string) => { area(side: number): number };
console.log("area-" + require("shape-pkg").area(3));
export {};
