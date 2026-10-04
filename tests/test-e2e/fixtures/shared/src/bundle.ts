import data from "@data";
import { acceptedValue } from "./contract";
import { values } from "./factory-values";
import { nativePipeline, nativeNeighbor, nativeOrdered, nativeOrderedNeighbor } from "./native-pipeline";
declare const globalThis: { TTSC_BATCH_RESULT?: unknown };
const discard = { call(): void { throw new Error("STRIPPED_CALL_RAN"); } };
debugger;
console.debug("STRIPPED_DEBUG_RAN");
discard.call();
export const authoredMarker = "authored-marker";
const defaultOnlyCall = () => { console.log("DEFAULT_ONLY_RETAINED"); };
const defaultOnlyCallRetained = String(defaultOnlyCall).includes("DEFAULT_ONLY_RETAINED");
export const result = { authoredMarker, defaultOnlyCallRetained, answer: acceptedValue(), data: data.answer, neighbor: data.neighbor, values, nativePipeline, nativeNeighbor, nativeOrdered, nativeOrderedNeighbor };
globalThis.TTSC_BATCH_RESULT = result;

