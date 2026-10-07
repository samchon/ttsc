import assert from "node:assert/strict";
import { result, observeEmittedEffects } from "./src/bundle.ts";
assert.equal(globalThis.TTSC_BATCH_RESULT, result);
observeEmittedEffects();
console.info("TTSC_BATCH:" + JSON.stringify(result));
