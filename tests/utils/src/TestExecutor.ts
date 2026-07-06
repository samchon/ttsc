import { DynamicExecutor } from "@nestia/e2e";

/**
 * Shared feature-test runner used by the package-shaped test projects.
 *
 * Test packages expose each scenario as a `test_*` function; this wrapper keeps
 * discovery, include/exclude filtering, sharding, and console reporting
 * identical across compiler, runner, lint, and plugin suites.
 */
export namespace TestExecutor {
  /** Location of the feature module tree that DynamicExecutor scans. */
  export interface IProps {
    location: string;
    /**
     * Approximate per-test cost (milliseconds) for the heavy,
     * go-binary-building scenarios. When a `--shard` is requested these are
     * Longest-Processing-Time bin-packed across shards so each parallel lane
     * carries a balanced slice of the expensive native builds; every other
     * (cheap) test is spread by a stable name hash. Only the heavy tests need
     * an entry — the map is a balancing hint, not an allow-list.
     */
    weights?: Record<string, number>;
    /**
     * Test-name substrings for scenarios that run in **every** shard and slice
     * their own workload internally (via `TTSC_TEST_SHARD_ACTIVE`). Use this
     * for a single data-driven corpus test that would otherwise pin a whole
     * shard; such a test must read the env and run only its slice.
     */
    spanning?: string[];
  }

  /** One shard's position within the parallel matrix (0-based index). */
  interface IShard {
    index: number;
    total: number;
  }

  /**
   * Execute every discovered `test_*` export under the requested location.
   *
   * Command-line filters intentionally match by substring so a failing scenario
   * can be rerun from any package with `--include=<case-name>` without adding
   * package-specific runner switches. `--shard=<i>/<N>` (1-based) — or the
   * `TTSC_TEST_SHARD` env — restricts a run to one balanced slice of the suite
   * so CI can fan the go-binary-building suites across parallel lanes.
   */
  export const main = async (props: IProps): Promise<void> => {
    const include = getArguments("include");
    const exclude = getArguments("exclude");
    const shard = resolveShard();
    const shardFilter = buildShardFilter(props, shard);
    const started = Date.now();
    const report: DynamicExecutor.IReport = await DynamicExecutor.validate({
      prefix: "test_",
      location: props.location,
      extension: "ts",
      parameters: () => [],
      onComplete: (exec) => {
        if (exec.value === false)
          console.log(`  - \x1b[32m${exec.name}\x1b[0m: Pass`);
        else if (exec.error === null) {
          const elapsed = Math.max(
            0,
            new Date(exec.completed_at).getTime() -
              new Date(exec.started_at).getTime(),
          );
          console.log(
            `  - \x1b[32m${exec.name}\x1b[0m: \x1b[33m${elapsed.toLocaleString()} ms\x1b[0m`,
          );
        } else
          console.log(
            `  - \x1b[32m${exec.name}\x1b[0m: \x1b[31m${exec.error.name}\x1b[0m`,
          );
      },
      filter: (name) =>
        (include.length ? include.some((str) => name.includes(str)) : true) &&
        (exclude.length ? exclude.every((str) => !name.includes(str)) : true) &&
        shardFilter(name),
    });

    if (report.executions.length === 0) {
      const reason = include.length
        ? `No tests matched --include=${include.join(",")}`
        : shard
          ? `No tests fell into shard ${shard.index + 1}/${shard.total} under ${props.location}`
          : `No tests were discovered under ${props.location}`;
      console.error(reason);
      process.exit(1);
    }

    const exceptions: Error[] = report.executions
      .filter((exec) => exec.error !== null)
      .map((exec) => exec.error!);
    for (const error of exceptions) console.error(error);
    if (shard)
      console.log(
        `Shard ${shard.index + 1}/${shard.total}:`,
        report.executions.length,
        "tests",
      );
    console.log(exceptions.length ? "Failed" : "Success");
    console.log(
      "Elapsed time",
      Math.max(0, Date.now() - started).toLocaleString(),
      "ms",
    );
    if (exceptions.length) process.exit(1);
  };

  /** Read comma-separated repeatable CLI filters such as `--include=a,b`. */
  function getArguments(key: string): string[] {
    const prefix = `--${key}=`;
    return process.argv
      .slice(2)
      .filter((arg) => arg.startsWith(prefix))
      .flatMap((arg) => arg.slice(prefix.length).split(","))
      .map((arg) => arg.trim())
      .filter(Boolean);
  }

  /**
   * Parse `--shard=<i>/<N>` (1-based) from argv, else the `TTSC_TEST_SHARD`
   * env.
   */
  function resolveShard(): IShard | null {
    const raw =
      getArguments("shard").at(-1) ?? process.env.TTSC_TEST_SHARD ?? "";
    if (!raw) return null;
    const match = /^(\d+)\/(\d+)$/.exec(raw.trim());
    if (!match)
      throw new Error(
        `Invalid --shard "${raw}"; expected "<i>/<N>" (1-based).`,
      );
    const index = Number(match[1]) - 1;
    const total = Number(match[2]);
    if (total < 1 || index < 0 || index >= total)
      throw new Error(`Invalid --shard "${raw}"; need 1 <= i <= N.`);
    return { index, total };
  }

  /**
   * Build the shard membership predicate. Heavy (weighted) tests are LPT
   * bin-packed for balance, spanning tests join every shard (and self-slice via
   * `TTSC_TEST_SHARD_ACTIVE`), and everything else is spread by a stable hash.
   */
  function buildShardFilter(
    props: IProps,
    shard: IShard | null,
  ): (name: string) => boolean {
    if (shard === null) return () => true;
    // Publish the active shard so a spanning corpus test can run its own slice.
    process.env.TTSC_TEST_SHARD_ACTIVE = `${shard.index + 1}/${shard.total}`;
    const spanning = props.spanning ?? [];
    const pinned = packWeighted(props.weights ?? {}, shard.total);
    return (name) => {
      if (spanning.some((needle) => name.includes(needle))) return true;
      const bin = pinned.get(name) ?? hash(name) % shard.total;
      return bin === shard.index;
    };
  }

  /**
   * Longest-Processing-Time bin-packing: assign each weighted test (heaviest
   * first) to the currently lightest shard, minimizing the busiest shard.
   */
  function packWeighted(
    weights: Record<string, number>,
    total: number,
  ): Map<string, number> {
    const load = new Array<number>(total).fill(0);
    const pinned = new Map<string, number>();
    for (const [name, weight] of Object.entries(weights).sort(
      (a, b) => b[1] - a[1],
    )) {
      let lightest = 0;
      let lightestLoad = load[0] ?? 0;
      for (let i = 1; i < total; i++) {
        const current = load[i] ?? 0;
        if (current < lightestLoad) {
          lightest = i;
          lightestLoad = current;
        }
      }
      load[lightest] = lightestLoad + weight;
      pinned.set(name, lightest);
    }
    return pinned;
  }

  /** FNV-1a: deterministic, well-distributed name hash for cheap-test spread. */
  function hash(text: string): number {
    let value = 2166136261;
    for (let i = 0; i < text.length; i++) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619);
    }
    return value >>> 0;
  }
}
