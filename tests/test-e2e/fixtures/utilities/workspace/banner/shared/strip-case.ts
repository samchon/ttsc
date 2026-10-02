export interface StripBox { value: string }
const assert = { equal(left: number, right: number): void { if (left !== right) throw new Error("assertion failed"); } };
debugger;
console.log("log-call");
console.debug("debug-call");
console.warn("warn-call");
assert.equal(1, 1);
console.info("kept");
export const box: StripBox = { value: "kept" };
if (box.value) console.log("guarded-log-call");
