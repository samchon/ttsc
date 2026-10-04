import { identity as a } from "./a/index.js";
import { identity as b } from "./b/index.js";
declare const require: (specifier: string) => { identity: string };
const observedDynamic = ["./a/index.ts", "./b/index.ts", "../../../tools/ownership/index.ts"].map((specifier) => require(specifier).identity);
export const observed = [a, b, ...observedDynamic].join(",");
const raw = require("raw-ownership") as { identity: string; answer: number; shout(value: string): string; namespaceBox: { value: number } };
export const packageOwn = raw.identity;
export const rawLowering = [raw.answer, raw.shout("ok"), raw.namespaceBox.value].join(":");
