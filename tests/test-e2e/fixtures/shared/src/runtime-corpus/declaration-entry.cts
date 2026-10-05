import { observed } from "./native-factory";
import { value } from "./declared-owned.cjs";
declare function require(id: string): { value: string };
const placement = require("../../tools/runtime-placement.ts");
if (placement.value !== "lowered") throw new Error("default orphan placement lost the typed value");
console.log(value);
console.log("TTSC_DECLARED_REGISTER:" + JSON.stringify(observed));
