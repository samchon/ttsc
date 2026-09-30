import { parseDump } from "./model/loadGraph";

/**
 * Qualify a viewer dump before reduction or HTTP lifetime can begin.
 *
 * @evidence contracts/common.md#principled-implementation The actual shared dump decoder validates syntax, schema agreement and complete shape before a viewer receives facts; failures preserve the existing owned diagnostic and code one.
 * @evidence contracts/common.md#clear-and-simple-design This namespace owns viewer validation/completion while parseDump owns schema authority and runView owns native capture, reduction and HTTP resources.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual generated validation is retained without a handwritten substitute, test-only producer or successful empty fallback.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the before-reduction/HTTP boundary; decode documents success transfer and diagnostic/code meaning.
 * @evidenceExclude contracts/performance.md#efficient-algorithms decode owns validation work; the namespace groups its result contract.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work No result cache is owned by the namespace; runView owns the one-shot snapshot lifetime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The grouping acquires no process/socket; decode transfers valid facts to runView.
 */
export namespace TtscGraphViewSnapshot {
  /**
   * Return validated facts, or the existing viewer diagnostic and failure code.
   *
   * @evidence contracts/common.md#principled-implementation parseDump is the sole generated schema authority; its owned messages pass through once, and an unowned exception receives the existing validation prefix.
   * @evidence contracts/common.md#clear-and-simple-design A discriminated result keeps failure before actual reduction/server creation; runView writes only the returned diagnostic and returns its code.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed validation never supplies raw facts; no partial cast or alternate executable bypasses the real decoder.
   * @evidence contracts/common.md#meaningful-documentation The headline explains valid-fact transfer versus failure diagnostic/code, without claiming this pure result is a process exit by itself.
   * @evidence contracts/performance.md#efficient-algorithms Shared JSON/schema validation is linear in submitted bytes and facts, followed by constant-count diagnostic prefix handling; no historical/project scan is introduced.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each supplied dump requires actual validation; runView reuses the subsequently reduced immutable HTTP payload.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only local parsed facts or diagnostic text are created; ownership transfers to the caller and no process, reader, socket or prior dump is retained.
   */
  export function decode(text: string):
    | { ok: true; raw: ReturnType<typeof parseDump> }
    | { ok: false; code: 1; diagnostic: string } {
    try {
      return { ok: true, raw: parseDump(text) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        code: 1,
        diagnostic: message.startsWith("@ttsc/graph:")
          ? `${message}\n`
          : `@ttsc/graph: could not validate the graph dump: ${message}\n`,
      };
    }
  }
}
