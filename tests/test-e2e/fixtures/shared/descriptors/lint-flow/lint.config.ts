declare const console: { log(value: string): void; error(value: string): void };
import plugins from "./typed-selection.js";
console.log("loading executable lint config");
console.error("executable lint config warning");
export default { extends: "./base.mjs", plugins };
