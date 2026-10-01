export interface StripBox { value: string }
const assert = { equal(left: number, right: number): void { if (left !== right) throw new Error("assertion failed"); } };
debugger;
console.log("drop");
console.debug("drop");
assert.equal(1, 1);
console.info("kept");
export const box: StripBox = { value: "kept" };
if (box.value) console.log("drop-if");
