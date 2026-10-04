import data from "@data";
import { acceptedValue } from "./contract";
import { values } from "./factory-values";
import { nativePipeline, nativeNeighbor } from "./native-pipeline";
declare const globalThis: { TTSC_BATCH_RESULT?: unknown };
const discard = { call(): void { throw new Error("STRIPPED_CALL_RAN"); } };
debugger;
console.debug("STRIPPED_DEBUG_RAN");
discard.call();
export const authoredMarker = "authored-marker";
export const result = { authoredMarker, answer: acceptedValue(), data: data.answer, neighbor: data.neighbor, values, nativePipeline, nativeNeighbor };
globalThis.TTSC_BATCH_RESULT = result;

