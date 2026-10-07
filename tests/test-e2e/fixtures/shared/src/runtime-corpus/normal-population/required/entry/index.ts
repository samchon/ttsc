declare const require: (path: string) => { identity: string };
export const identity: string = "entry";
const other = require("../other/index.ts");
export const value = "other=" + other.identity;
