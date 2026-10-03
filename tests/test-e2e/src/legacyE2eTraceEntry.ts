import { createRequire } from "node:module";

import { E2eProcessTrace } from "../../utils/src/E2eProcessTrace";

/**
 * Marks the actual test runner process, then imports the unchanged legacy entry.
 * CLI filters, environment, test locations and exit-code handling remain owned
 * by that entry. This marker is not proof that its descendants have closed.
 *
 * @evidence contracts/common.md#principled-implementation Records this actual writer's runner admission and return around the same index module, without replacing test results or changing the selected invocation filters.
 * @evidence contracts/common.md#clear-and-simple-design One test-owned entry supplies a writer marker even for a portable selection with no child primitive, leaving discovery and assertions in the existing index.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts It does not infer process starts from runner admission, count a worker thread as a child or fabricate missing test outcomes.
 * @evidence contracts/common.md#meaningful-documentation States legacy entry ownership and distinguishes runner return from actual descendant closure.
 * @evidence contracts/portability.md#os-neutral-implementation Uses native module resolution for the explicit authored runtime; actual process PID/version are observations, not platform capability or executable image proofs.
 * @evidence contracts/performance.md#efficient-algorithms Two constant-size runner markers bracket the existing work, with the same bounded runtime sink overhead on both measurements.
 * @evidence contracts/performance.md#reuse-equivalent-work Node imports the actual index once for this fresh runner process; no completed test or process result is borrowed from another run.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Marker writes close synchronously. Existing test owners retain child/session cleanup; the outer coordinator waits for this process close and retains the trace root.
 */
export async function legacyE2eTraceEntry(): Promise<void> {
  const runtime = createRequire(import.meta.url)(E2eProcessTrace.runtimePath) as {
    begin(): string | undefined;
    record(event: string, invocation: string | undefined, fields: Record<string, unknown>): void;
  };
  const invocation = runtime.begin();
  runtime.record("runner-admission", invocation, {
    pid: process.pid, argv: process.argv, cwd: process.cwd(),
    data: { writerRuntime: process.version, runner: "legacy-index", entry: import.meta.url },
  });
  try {
    await import("./index");
  } finally {
    runtime.record("runner-return", invocation, {
      pid: process.pid,
      data: { writerRuntime: process.version, runner: "legacy-index", exitCode: process.exitCode ?? 0,
        descendantJoinCertified: false },
    });
  }
}

await legacyE2eTraceEntry();
