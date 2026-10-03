import { createRequire } from "node:module";

import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";

const trace = createRequire(import.meta.url)(E2eProcessTrace.runtimePath) as {
  begin(): string | undefined;
  record(event: string, invocation: string | undefined, fields: Record<string, unknown>): void;
};

/** Runs the independent scenarios of one package experiment. */
export namespace Scenarios {
  /**
   * Run every independent scenario and report each failure under its name.
   *
   * A failed verdict does not stop later independent observations. Callers may
   * share a settled producer, workspace or output when their authored oracles
   * remain independent. Each caller owns the reuse gate: unresolved readers or
   * failed input restoration must prevent unsafe later mutations and launches;
   * collecting an error does not grant permission to reuse its inputs.
   *
   * @evidence contracts/common.md#principled-implementation Each scenario runs to its own verdict and its failure is wrapped with the scenario name and original cause, so the aggregate preserves failure identity.
   * @evidence contracts/common.md#clear-and-simple-design A loop and one aggregate error replace a runner abstraction; ordering follows the declaration.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No failure is retried, downgraded or filtered, and an empty scenario list is itself rejected.
   * @evidence contracts/common.md#meaningful-documentation States the independence assumption that allows collecting failures.
   * @evidence contracts/portability.md#os-neutral-implementation Scenario names remain plain strings. Enabled observation delegates actual native append/close to the same test-owned trace runtime as both measurement phases; disabled tracing emits no events or filesystem IO. Profile markers are not child-process events.
   * @evidence contracts/performance.md#efficient-algorithms Scenarios run once each. Enabled tracing adds two events proportional to label/name text, separate from the callback's work and native process counters.
   * @evidence contracts/performance.md#reuse-equivalent-work It adds no computation of its own and shares only the opened workspace through the scenario closures.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retains one error per failed scenario until the aggregate is thrown. Observation append/close and integrity budgets remain trace-runtime owned; markers certify actual invocation/return/throw only, not assertion coverage or callback resource retirement.
   */
  export async function collect(
    label: string,
    scenarios: ReadonlyArray<readonly [string, () => unknown]>,
  ): Promise<void> {
    if (scenarios.length === 0) throw new Error(`${label} has no scenarios`);
    const failures: Error[] = [];
    for (const [name, run] of scenarios) {
      const invocation = trace.begin();
      trace.record("profile-invocation", invocation, {
        pid: process.pid,
        data: { writerRuntime: process.version, label, name },
      });
      try {
        await run();
        trace.record("profile-result", invocation, {
          pid: process.pid,
          data: { writerRuntime: process.version, label, name, outcome: "returned",
            assertionCoverageCertified: false },
        });
      } catch (error) {
        trace.record("profile-result", invocation, {
          pid: process.pid,
          data: { writerRuntime: process.version, label, name, outcome: "threw",
            assertionCoverageCertified: false },
        });
        failures.push(
          new Error(
            `${name}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
            { cause: error },
          ),
        );
      }
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        `${label} scenarios failed: ${failures.map((failure) => failure.message).join("; ")}`,
      );
  }
}
