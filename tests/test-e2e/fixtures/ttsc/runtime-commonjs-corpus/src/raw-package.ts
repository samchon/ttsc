declare const require: (id: string) => { marker: string };
console.log("rawpkg=" + require("rawpkg").marker);
export {};
