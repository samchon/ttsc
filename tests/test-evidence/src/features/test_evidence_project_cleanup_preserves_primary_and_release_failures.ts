import assert from "node:assert/strict";

import { withEvidenceProject } from "../../../utils/src/evidence/withEvidenceProject";

/**
 * Verifies synchronous fixture ownership preserves operation and release failures.
 *
 * Authored callbacks are inputs to this owner, so no product method or foreign
 * global is replaced. Every scenario executes independently before collected
 * assertion failures are reported.
 *
 * A non-executed branch is a compile-only fixture: the package TypeScript check
 * must reject asynchronous callbacks. The transpile-only source-unit runner
 * executes the seven ownership scenarios but does not verify those type errors.
 *
 * 1. Supply literal results and failure sentinels to seven synchronous scenarios.
 * 2. Assert operation-before-cleanup order and exact return or failure identity,
 *    including both failures and undefined thrown from either callback.
 * 3. Keep Promise, async, union and PromiseLike operation returns plus asynchronous
 *    cleanup as expected type errors in the package's whole-source type check.
 * 4. Run every runtime scenario before reporting collected assertion failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Invokes withEvidenceProject with explicit operation and cleanup callbacks, asserting exact result identity, operation-before-release order and single versus combined failure identity.
 * @evidence contracts/testing.md#independent-expectations Literal sentinel objects, undefined thrown values and the authored operation/cleanup order establish the expected outcome independently of the owner's failure bookkeeping.
 * @evidence contracts/testing.md#distinguishing-cases Success, operation-only failure, cleanup-only failure, both failures and undefined from either or both callbacks distinguish unconditional release from error swallowing or failure replacement. Compile-only expect-error calls distinguish Promise, async, union and PromiseLike operations and asynchronous cleanup from synchronous result preservation.
 * @evidence contracts/testing.md#execution-ownership This named source-unit export is discovered in test-evidence src/features and selected by the central unit configuration; it calls the authored owner directly without consumer installation, native compilation or a product subprocess. The suite start command type-checks before source discovery, so its TypeScript check consumes the compile-only expected errors in the unit lane, and neither path executes asynchronous fixture calls.
 */
export function test_evidence_project_cleanup_preserves_primary_and_release_failures(): void {
  if (false) {
    const project = { cleanup(): void {} };
    // @ts-expect-error Promise work outlives this synchronous release owner.
    withEvidenceProject(project, () => Promise.resolve(1));
    // @ts-expect-error An async operation returns a Promise even without await.
    withEvidenceProject(project, async () => 1);
    // @ts-expect-error A union can complete asynchronously on one branch.
    withEvidenceProject(project, (): number | Promise<number> => Math.random() ? 1 : Promise.resolve(1));
    // @ts-expect-error PromiseLike completion also requires an asynchronous owner.
    withEvidenceProject(project, (): PromiseLike<number> => Promise.resolve(1));
    // @ts-expect-error Async cleanup does not complete when this call returns.
    withEvidenceProject({ async cleanup() {} }, () => 1);
    // @ts-expect-error A Promise-returning cleanup cannot be a synchronous owner.
    withEvidenceProject({ cleanup: () => Promise.resolve() }, () => 1);
    // @ts-expect-error A cleanup union can retain resources after return.
    withEvidenceProject({ cleanup: (): void | Promise<void> => Math.random() ? undefined : Promise.resolve() }, () => 1);
    // @ts-expect-error PromiseLike cleanup does not prove synchronous release.
    withEvidenceProject({ cleanup: (): PromiseLike<void> => Promise.resolve() }, () => 1);
  }
  const value = { result: "owned result" };
  const primary = { failure: "primary" };
  const release = { failure: "release" };
  const scenarios = [
    { name: "success", operationThrows: false, cleanupThrows: false, primary, release },
    { name: "operation", operationThrows: true, cleanupThrows: false, primary, release },
    { name: "cleanup", operationThrows: false, cleanupThrows: true, primary, release },
    { name: "combined", operationThrows: true, cleanupThrows: true, primary, release },
    { name: "undefined operation", operationThrows: true, cleanupThrows: false, primary: undefined, release },
    { name: "undefined cleanup", operationThrows: false, cleanupThrows: true, primary, release: undefined },
    { name: "undefined combined", operationThrows: true, cleanupThrows: true, primary: undefined, release: undefined },
  ];
  const assertionFailures: unknown[] = [];
  for (const scenario of scenarios) {
    try {
      const order: string[] = [];
      let threw = false;
      let thrown: unknown;
      let result: unknown;
      try {
        result = withEvidenceProject(
          {
            cleanup(): void {
              order.push("cleanup");
              if (scenario.cleanupThrows) throw scenario.release;
            },
          },
          () => {
            order.push("operation");
            if (scenario.operationThrows) throw scenario.primary;
            return value;
          },
        );
      } catch (error) {
        threw = true;
        thrown = error;
      }
      assert.deepEqual(order, ["operation", "cleanup"], scenario.name);
      assert.equal(threw, scenario.operationThrows || scenario.cleanupThrows, scenario.name);
      if (!threw) assert.equal(result, value, scenario.name);
      else if (scenario.operationThrows && scenario.cleanupThrows) {
        assert.ok(thrown instanceof AggregateError, scenario.name);
        assert.equal(thrown.errors.length, 2, scenario.name);
        assert.equal(thrown.errors[0], scenario.primary, scenario.name);
        assert.equal(thrown.errors[1], scenario.release, scenario.name);
      } else
        assert.equal(thrown, scenario.operationThrows ? scenario.primary : scenario.release, scenario.name);
    } catch (error) {
      assertionFailures.push(error);
    }
  }
  if (assertionFailures.length === 1) throw assertionFailures[0];
  if (assertionFailures.length > 1)
    throw new AggregateError(assertionFailures, "Evidence cleanup ownership cases failed.");
}
