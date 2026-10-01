declare const assert: { equal(left: unknown, right: unknown): void };
console.log("drop-log");
console.debug("drop-debug");
assert.equal("drop", "assert");
debugger;
export const value = "kept";
