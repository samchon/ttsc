import { identity as a } from "./a/index.js";
import { identity as b } from "./b/index.js";
declare const require: (specifier: string) => { identity: string };
const observedDynamic = ["./a/index.ts", "./b/index.ts", "../../../tools/ownership/index.cts"].map((specifier) => require(specifier).identity);
export const observed = [a, b, ...observedDynamic].join(",");
export const packageOwn = require("raw-ownership").identity;
