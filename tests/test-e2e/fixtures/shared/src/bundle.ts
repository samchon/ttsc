import { linkedValue } from "batch-linked-value";
import data from "@data";
import { acceptedValue } from "./contract";
import { values } from "./factory-values";
import { nativePipeline, nativeNeighbor, nativeOrdered, nativeOrderedNeighbor, __TTSC_OWN_MARKER__, numericNeighbor } from "./native-pipeline";
declare const globalThis: { TTSC_BATCH_RESULT?: unknown };
const discard = { call(): void { throw new Error("STRIPPED_CALL_RAN"); } };
const logger = { trace(message: string): void { throw new Error(`CONFIGURED_TRACE_RAN:${message}`); } };
export function observeEmittedEffects(): void {
  debugger;
  console.debug("STRIPPED_DEBUG_RAN");
  discard.call();
  logger.trace("drop");
}
export const authoredMarker = "authored-marker";
const defaultOnlyCall = () => { console.log("DEFAULT_ONLY_RETAINED"); };
const defaultOnlyCallRetained = String(defaultOnlyCall).includes("DEFAULT_ONLY_RETAINED");
export const result = { authoredMarker, linkedValue, defaultOnlyCallRetained, answer: acceptedValue(), data: data.answer, neighbor: data.neighbor, values, nativePipeline, nativeNeighbor, nativeOrdered, nativeOrderedNeighbor, nativeNumeric: __TTSC_OWN_MARKER__, numericNeighbor };
globalThis.TTSC_BATCH_RESULT = result;

