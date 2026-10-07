import { used } from "./library";
import { boom } from "./boom";
declare function require(request: string): any;
declare const console: { info(value: string): void; error(value: string): void };
const mapped = require("map-mapped");
const forced = require("map-forced");
console.info([used(), mapped.used(), forced.used()].join("|"));
const records: { name: string; threw: boolean; stack?: string }[] = [];
let last: unknown;
for (const [name, fn] of [["boom", boom], ["depBoom", mapped.depBoom], ["forcedBoom", forced.depBoom]] as const) {
  try { fn(); records.push({ name, threw: false }); }
  catch (error) { last = error; const stack = (error as Error).stack; console.error(stack ?? "missing stack"); records.push({ name, threw: true, stack }); }
}
console.info("TTSC_MAP_STACKS:" + JSON.stringify(records));
if (last !== undefined) throw last;
