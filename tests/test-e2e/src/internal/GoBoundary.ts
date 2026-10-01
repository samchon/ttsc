import assert from "node:assert/strict";
import path from "node:path";

import { TestProject } from "../../../utils/src/TestProject";

/** Executes package-owned Go connection cases in one Go test process. */
export namespace GoBoundary {
  /**
   * Run the explicitly named connection population and preserve Go failure names.
   *
   * The package owns its Go source, fixtures and test cleanup. This entry only
   * selects the E2E build tag and checks that every requested case actually ran.
   * Go JSON events distinguish capability skips from executed assertions.
   *
   * @evidence contracts/common.md#principled-implementation Exact Go test names select their owning package's actual Test bodies. The JSON run and terminal events establish execution independently of process exit zero, which also occurs for an empty selection.
   * @evidence contracts/common.md#clear-and-simple-design One synchronous command owns the Go test process, while Go test owns case ordering, independent failure collection and package cleanup.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Case output is forwarded without retry, status substitution or fabricated test events. Missing selected cases fail and capability skips are printed without coverage claims.
   * @evidence contracts/common.md#meaningful-documentation States selection, fixture ownership, process joining and skip interpretation separately from these acknowledgments.
   * @evidence contracts/portability.md#os-neutral-implementation TTSC_GO_BINARY explicitly selects the toolchain, otherwise go resolves through the invocation's PATH, including setup-go in CI. Node passes argv without a shell and joins the native module path.
   * @evidence contracts/performance.md#efficient-algorithms Event processing visits each output line once and set membership checks each requested case once. Output retention scales with the command's emitted bytes up to the spawn helper's 64 MiB buffer limit; exceeding that limit fails the invocation.
   * @evidence contracts/performance.md#reuse-equivalent-work Every selected case shares one Go test binary and process. The existing shared Go object cache reuses equivalent compilation while count=1 preserves actual case execution.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The synchronous child is joined before return; Go package cleanup owns its fixture resources. Output is retained through result validation and grows with emitted bytes up to the shared spawn helper's 64 MiB buffer limit.
   */
  export function run(
    module: string,
    population: string | readonly string[],
    names: readonly string[],
    env: NodeJS.ProcessEnv = {},
  ): void {
    assert.ok(names.length > 0, "Go boundary selection must name cases");
    const result = TestProject.spawn(process.env.TTSC_GO_BINARY || "go", [
      "test", "-json", "-tags=e2e", "-count=1", "-run", `^(${names.join("|")})$`,
      ...(typeof population === "string" ? [population] : population),
    ], { cwd: path.join(TestProject.WORKSPACE_ROOT, "packages", module), env });
    const ran = new Set<string>();
    const completed = new Set<string>();
    for (const line of result.stdout.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as { Action: string; Test?: string; Output?: string };
      if (event.Output) process.stdout.write(event.Output);
      if (!event.Test) continue;
      if (event.Action === "run") ran.add(event.Test);
      if (["pass", "fail", "skip"].includes(event.Action)) completed.add(event.Test);
      if (event.Action === "skip") console.log(`${event.Test}: SKIPPED (Go capability guard; no coverage claimed)`);
    }
    if (result.stderr) process.stderr.write(result.stderr);
    const missing = names.filter((name) => !ran.has(name) || !completed.has(name));
    assert.equal(missing.length, 0, `Go boundary cases did not complete: ${missing.join(", ")}`);
    assert.equal(result.status, 0, `Go boundary ${module}/${population} failed. See the named Go case output above.`);
  }
}
