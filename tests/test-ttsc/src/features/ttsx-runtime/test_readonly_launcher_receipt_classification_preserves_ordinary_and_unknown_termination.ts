import assert from "node:assert/strict";

import { isOrdinarilyClosedReadonlyLauncher } from "../../../../utils/src/isOrdinarilyClosedReadonlyLauncher";

/**
 * Verifies only the readonly launcher's source metadata decision. Authored
 * tuples are direct inputs to the actual exported classifier, not substituted
 * child-process results. No process API, environment or product method changes.
 * Actual native completion, descendant joins and ACL restoration remain the
 * readonly corpus's separate boundary; this unit claims none of those results.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes the actual source predicate for all twelve receipt tuples and collects each labeled mismatch before failing the owning unit.
 * @evidence contracts/testing.md#independent-expectations Explicit true/false literals independently specify ordinary metadata versus uncertainty; expected values are not derived from the classifier or a child result.
 * @evidence contracts/testing.md#distinguishing-cases Completed statuses 0, 2 and 1 contrast with null status, signals, launch errors, error despite status, zero/negative/noninteger/infinite PIDs.
 * @evidence contracts/testing.md#execution-ownership This named source unit imports the exact operation used by the real private readonly launcher and calls it directly; no root, child, compiler, ACL process or fake backend executes.
 */
export function test_readonly_launcher_receipt_classification_preserves_ordinary_and_unknown_termination(): void {
  type Receipt = Parameters<typeof isOrdinarilyClosedReadonlyLauncher>[0];
  const cases: { name: string; receipt: Receipt; expected: boolean }[] = [
    {
      name: "ordinary-success",
      receipt: { status: 0, signal: null, pid: 19 },
      expected: true,
    },
    {
      name: "expected-excluded-failure",
      receipt: { status: 2, signal: null, pid: 19 },
      expected: true,
    },
    {
      name: "ordinary-unexpected-failure",
      receipt: { status: 1, signal: null, pid: 19 },
      expected: true,
    },
    {
      name: "missing-status",
      receipt: { status: null, signal: null, pid: 19 },
      expected: false,
    },
    {
      name: "terminated-host",
      receipt: { status: null, signal: "SIGTERM", pid: 19 },
      expected: false,
    },
    {
      name: "signal-with-status",
      receipt: { status: 0, signal: "SIGTERM", pid: 19 },
      expected: false,
    },
    {
      name: "failed-launch",
      receipt: {
        status: null,
        signal: null,
        pid: 0,
        error: new Error("launch refused"),
      },
      expected: false,
    },
    {
      name: "error-despite-status",
      receipt: {
        status: 0,
        signal: null,
        pid: 19,
        error: new Error("unresolved result"),
      },
      expected: false,
    },
    {
      name: "missing-pid",
      receipt: { status: 0, signal: null, pid: 0 },
      expected: false,
    },
    {
      name: "invalid-negative-pid",
      receipt: { status: 0, signal: null, pid: -1 },
      expected: false,
    },
    {
      name: "invalid-noninteger-pid",
      receipt: { status: 0, signal: null, pid: 0.5 },
      expected: false,
    },
    {
      name: "invalid-infinite-pid",
      receipt: { status: 0, signal: null, pid: Infinity },
      expected: false,
    },
  ];
  const failures: Error[] = [];
  for (const testCase of cases) {
    try {
      assert.equal(
        isOrdinarilyClosedReadonlyLauncher(testCase.receipt),
        testCase.expected,
        testCase.name,
      );
    } catch (cause) {
      failures.push(new Error(testCase.name, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "readonly launcher receipt classification",
    );
}
