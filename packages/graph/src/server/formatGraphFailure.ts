import { inspect } from "node:util";
import { serializeCompilerError } from "ttsc";

/**
 * Render a terminal graph failure with its nested causes and aggregate members.
 *
 * The SDK's descriptor-based failure description preserves causes and shared
 * references without evaluating getters. Node then displays that passive data
 * without invoking custom inspectors. Proxy reflection retains the serializer's
 * documented inspection limits.
 *
 * It is stderr text, not a serialization format or a retirement certificate.
 *
 * @evidence contracts/common.md#principled-implementation The SDK failure serializer preserves nested causes and aggregate members as passive data; Node inspection renders that finite description rather than projecting the outer message.
 * @evidence contracts/common.md#clear-and-simple-design One renderer owns shutdown diagnostic text; the server continues to own its failing exit status.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Diagnostic formatting changes no cleanup result, admission state or original lifetime proof.
 * @evidence contracts/common.md#meaningful-documentation Native prose defines nested diagnostics, disabled user hooks and the absence of transport or retirement authority.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This renderer observes JavaScript values and selects no OS path or process primitive.
 * @evidence contracts/performance.md#efficient-algorithms Delegated serialization visits distinct observed objects and owned fields; unlimited diagnostic inspection then renders that finite description. Structural work and returned text grow with the observed diagnostic graph, excluding arbitrary Proxy reflection.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each failure is rendered when reported; there is no reusable computation population.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned diagnostic string is caller-owned; no handle or retained cache is acquired.
 */
export function formatGraphFailure(error: unknown): string {
  return inspect(serializeCompilerError(error), {
    depth: null,
    customInspect: false,
    getters: false,
    colors: false,
    maxArrayLength: null,
    maxStringLength: null,
  });
}
