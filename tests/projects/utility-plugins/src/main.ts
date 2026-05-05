import { join } from "@lib/join";
import { message } from "exact-message";

export type JoinFunction = typeof import("@lib/join").join;
export type MessageValue = typeof import("exact-message").message;

const assert = {
  equal(left: string, right: string): void {
    if (left !== right) throw new Error("assertion failed");
  },
};

debugger;
console.debug("debug-only");
console.log("log-only");
assert.equal(message, "hello");

export const output: string = join(message, "ok");
console.info(output);
