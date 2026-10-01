import { loadGraph } from "@ttsc/graph";
import assert from "node:assert/strict";

import { installedTargetBoundary, launch } from "../../internal/graph/internal/installedTargetBoundary";

const RESOLVE_FAIL = /could not resolve the ttscgraph binary/u;

/**
 * Verifies target-installed native resolution reaches every executing facade.
 *
 * A launcher started outside the target must use the target's installed peer.
 * Pure resolution controls belong to source units; these observations retain
 * the actual dump, viewer and loader process connections with a real producer.
 *
 * 1. Reuse the cold target dump, then contrast missing installation and absolute override.
 * 2. Reach a real native configuration failure through viewer and loader from the target.
 * 3. Require the actionable missing-binary diagnostic from their uninstalled twins.
 *
 * @evidence contracts/testing.md#behavioral-verification Installed dump produces NativeTargetControl, absolute override produces NativeOverrideControl, and missing installation returns status one. Viewer and loadGraph reach genuine invalid-config failure after target resolution; missing twins retain the owned resolution error.
 * @evidence contracts/testing.md#independent-expectations Literal declarations, status-zero/one, nonempty failures and the distinct missing-binary diagnostic define expectations independently of resolver output or producer serialization.
 * @evidence contracts/testing.md#distinguishing-cases Installed target versus unrelated launcher cwd, absent peer versus absolute override, and valid dump versus real invalid-config consumer failure retain each execution lane. Parser malformed-output negatives remain at the actual generated decoder/viewer owners.
 * @evidence contracts/testing.md#execution-ownership This features entry executes the installed launcher/model package against an actual copied native producer. Source filesystem units own override precedence, defaults and lazy session construction without executing their inert path.
 * @evidence contracts/e2e.md#necessary-boundary Each real facade must forward its selected project to installed module resolution and native execution; direct resolver tests cannot establish those connections.
 * @evidence contracts/e2e.md#shared-execution Target dump and POSIX permission controls share one installed copy and cold first dump. The independent override, viewer and loader paths retain only their required real invocations; the negative resolution twins start no native producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-owned installed/uninstalled projects contain distinct declarations. Invalid config uses a separate file without mutating the valid config; each synchronous native call joins, and loader override state is restored finally. Independent assertions collect before reporting.
 * @evidence contracts/e2e.md#preserved-coverage Original dump status, execution witness, missing/override controls and view/load non-resolution-failure distinctions remain. Fake marker execution becomes real compiler facts; fake malformed load output becomes a genuine compiler failure, with malformed-output parser assertions retained at their own decoder boundary.
 */
export async function test_ttscgraph_target_installed_consumers_share_native_boundary(): Promise<void> {
  const target = installedTargetBoundary();
  const errors: unknown[] = [];
  const cases: [string, () => void][] = [
    ["target dump", () => {
      assert.doesNotMatch(target.dump.stderr ?? "", RESOLVE_FAIL);
      assert.equal(target.dump.status, 0, target.dump.stderr);
      const dump = JSON.parse(target.dump.stdout) as { nodes: { name: string }[] };
      assert.ok(dump.nodes.some((node) => node.name === "NativeTargetControl"));
    }],
    ["missing dump", () => {
      const result = launch(["dump", "--cwd", target.empty], { cwd: target.elsewhere, graphBinary: "" });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr ?? "", RESOLVE_FAIL);
    }],
    ["absolute override dump", () => {
      const result = launch(["dump", "--cwd", target.empty], { cwd: target.elsewhere, graphBinary: target.binary });
      assert.doesNotMatch(result.stderr ?? "", RESOLVE_FAIL);
      assert.equal(result.status, 0, result.stderr);
      const dump = JSON.parse(result.stdout) as { nodes: { name: string }[] };
      assert.ok(dump.nodes.some((node) => node.name === "NativeOverrideControl"));
    }],
    ["target viewer", () => {
      const result = launch(["view", "--cwd", target.root, "--tsconfig", "invalid.json", "--no-open", "--port", "0"], { cwd: target.elsewhere, graphBinary: "" });
      assert.equal(result.status, 1, result.stderr);
      assert.notEqual(result.stderr, "");
      assert.doesNotMatch(result.stderr ?? "", RESOLVE_FAIL);
      assert.doesNotMatch(result.stderr ?? "", /serving the 3D viewer/u);
    }],
    ["missing viewer", () => {
      const result = launch(["view", "--cwd", target.empty, "--no-open", "--port", "0"], { cwd: target.elsewhere, graphBinary: "" });
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr ?? "", RESOLVE_FAIL);
    }],
    ["target loader", () => withoutOverride(() => {
      assert.throws(() => loadGraph({ cwd: target.root, tsconfig: "invalid.json" }), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.notEqual(error.message, "");
        assert.doesNotMatch(error.message, RESOLVE_FAIL);
        return true;
      });
    })],
    ["missing loader", () => withoutOverride(() => {
      assert.throws(() => loadGraph({ cwd: target.empty, tsconfig: "tsconfig.json" }), RESOLVE_FAIL);
    })],
  ];
  for (const [name, run] of cases) {
    try { run(); } catch (error) { errors.push(new Error(name, { cause: error })); }
  }
  if (errors.length !== 0) throw new AggregateError(errors, "target-installed consumer assertions failed");
}

function withoutOverride(body: () => void): void {
  const previous = process.env.TTSC_GRAPH_BINARY;
  delete process.env.TTSC_GRAPH_BINARY;
  try { body(); }
  finally {
    if (previous === undefined) delete process.env.TTSC_GRAPH_BINARY;
    else process.env.TTSC_GRAPH_BINARY = previous;
  }
}
