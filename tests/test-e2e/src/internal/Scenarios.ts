/** Runs the independent scenarios of one package experiment. */
export namespace Scenarios {
  /**
   * Run every independent scenario and report each failure under its name.
   *
   * A failed scenario does not stop the others, because they own separate
   * directories of one workspace and none consumes another's output.
   *
   * @evidence contracts/common.md#principled-implementation Each scenario runs to its own verdict and its failure is wrapped with the scenario name and original cause, so the aggregate preserves failure identity.
   * @evidence contracts/common.md#clear-and-simple-design A loop and one aggregate error replace a runner abstraction; ordering follows the declaration.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No failure is retried, downgraded or filtered, and an empty scenario list is itself rejected.
   * @evidence contracts/common.md#meaningful-documentation States the independence assumption that allows collecting failures.
   * @evidence contracts/portability.md#os-neutral-implementation It touches no filesystem or process boundary; scenario names are plain strings, so no platform path or separator semantics apply.
   * @evidence contracts/performance.md#efficient-algorithms Scenarios run once each, so cost is the sum of their own work.
   * @evidence contracts/performance.md#reuse-equivalent-work It adds no computation of its own and shares only the opened workspace through the scenario closures.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Retains one error per failed scenario until the aggregate is thrown and owns no handle.
   */
  export async function collect(
    label: string,
    scenarios: ReadonlyArray<readonly [string, () => unknown]>,
  ): Promise<void> {
    if (scenarios.length === 0) throw new Error(`${label} has no scenarios`);
    const failures: Error[] = [];
    for (const [name, run] of scenarios) {
      try {
        await run();
      } catch (error) {
        failures.push(
          new Error(`${name}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`, { cause: error }),
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
