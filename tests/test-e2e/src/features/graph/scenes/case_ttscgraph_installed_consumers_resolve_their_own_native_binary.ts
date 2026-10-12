import assert from "node:assert/strict";

import {
  installedTargetBoundary,
  launch,
} from "../../../internal/graph/internal/installedTargetBoundary";

const RESOLVE_FAIL = /could not resolve the ttscgraph binary/u;

/**
 * Verifies installation-anchored native resolution reaches every executing
 * facade.
 *
 * An installed `@ttsc/graph` must spawn the producer from its own
 * `@ttsc/graph-<platform>-<arch>` package, whatever directory the launcher
 * starts in and whichever project it graphs. Pure resolution controls belong to
 * source units; these observations retain the actual dump, viewer and loader
 * process connections with a real producer.
 *
 * 1. Reuse the installation's cold dump from an unrelated directory, then contrast
 *    an installation without its platform package and an absolute override.
 * 2. Reach a real native configuration failure through the installation's viewer
 *    and loader.
 * 3. Require the actionable missing-binary diagnostic from the installation
 *    without its platform package.
 *
 * @evidence contracts/testing.md#behavioral-verification The installation's dump produces NativeTargetControl from an unrelated cwd, the missing installation returns status one with the resolution error, and an absolute override through the missing installation produces NativeOverrideControl. The installation's viewer and loadGraph reach a genuine invalid-config failure; the missing installation's viewer and loadGraph retain the owned resolution error.
 * @evidence contracts/testing.md#independent-expectations Literal declarations, status zero/one, nonempty failures and the distinct missing-binary diagnostic define expectations independently of resolver output or producer serialization.
 * @evidence contracts/testing.md#distinguishing-cases Installed versus missing platform package, absent versus absolute override, and valid dump versus real invalid-config failure retain each execution lane. Neither target project nor the launcher cwd holds a producer, so a resolver that still anchored at the target would fail the installed controls. Parser malformed-output negatives remain at the actual decoder and viewer owners.
 * @evidence contracts/testing.md#execution-ownership The selected Graph DAG invokes this combined body after the installation's cold dump. Two copies of the built @ttsc/graph with linked dependencies, one beside a real native copy, exercise real module resolution and native dispatch. This is not a packed SDK installation; test_e2e_installation owns the packed identity and direct resolver units retain the pure precedence decisions.
 * @evidence contracts/e2e.md#necessary-boundary Each real facade must resolve its producer from its own installation and pass the selected project to native execution; direct resolver tests cannot establish those process connections.
 * @evidence contracts/e2e.md#shared-execution The installation dump and POSIX permission controls share one native copy and cold first dump. The override, viewer and loader paths retain only their required real invocations; the missing-installation twins start no native producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-owned projects contain distinct declarations and the two installations differ only in the platform package. Invalid config uses a separate file without mutating the valid config; each synchronous call supplies its direct command outcome, not arbitrary descendant termination or inherited-handle closure, and the original loader override absence/value is restored finally. Independent assertions collect before reporting.
 * @evidence contracts/e2e.md#preserved-coverage Original dump status, execution witness, missing/override controls and view/load non-resolution-failure distinctions remain; the missing control now removes the installation's platform package instead of the target's ttsc, because the producer moved to @ttsc/graph.
 */
export async function case_ttscgraph_installed_consumers_resolve_their_own_native_binary(): Promise<void> {
  const target = installedTargetBoundary();
  const errors: unknown[] = [];
  const cases: [string, () => void][] = [
    [
      "installed dump",
      () => {
        assert.doesNotMatch(target.dump.stderr ?? "", RESOLVE_FAIL);
        assert.equal(target.dump.status, 0, target.dump.stderr);
        const dump = JSON.parse(target.dump.stdout) as {
          nodes: { name: string }[];
        };
        assert.ok(
          dump.nodes.some((node) => node.name === "NativeTargetControl"),
        );
      },
    ],
    [
      "missing dump",
      () => {
        const result = launch(["dump", "--cwd", target.root], {
          cwd: target.elsewhere,
          graphBinary: "",
          launcher: target.missing.launcher,
        });
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr ?? "", RESOLVE_FAIL);
      },
    ],
    [
      "absolute override dump",
      () => {
        const result = launch(["dump", "--cwd", target.empty], {
          cwd: target.elsewhere,
          graphBinary: target.binary,
          launcher: target.missing.launcher,
        });
        assert.doesNotMatch(result.stderr ?? "", RESOLVE_FAIL);
        assert.equal(result.status, 0, result.stderr);
        const dump = JSON.parse(result.stdout) as { nodes: { name: string }[] };
        assert.ok(
          dump.nodes.some((node) => node.name === "NativeOverrideControl"),
        );
      },
    ],
    [
      "installed viewer",
      () => {
        const result = launch(
          [
            "view",
            "--cwd",
            target.root,
            "--tsconfig",
            "invalid.json",
            "--no-open",
            "--port",
            "0",
          ],
          { cwd: target.elsewhere, graphBinary: "" },
        );
        assert.equal(result.status, 1, result.stderr);
        assert.notEqual(result.stderr, "");
        assert.doesNotMatch(result.stderr ?? "", RESOLVE_FAIL);
        assert.doesNotMatch(result.stderr ?? "", /serving the 3D viewer/u);
      },
    ],
    [
      "missing viewer",
      () => {
        const result = launch(
          ["view", "--cwd", target.root, "--no-open", "--port", "0"],
          {
            cwd: target.elsewhere,
            graphBinary: "",
            launcher: target.missing.launcher,
          },
        );
        assert.equal(result.status, 1, result.stderr);
        assert.match(result.stderr ?? "", RESOLVE_FAIL);
      },
    ],
    [
      "installed loader",
      () =>
        withoutOverride(() => {
          assert.throws(
            () =>
              target.installed.loadGraph({
                cwd: target.root,
                tsconfig: "invalid.json",
              }),
            (error: unknown) => {
              assert.ok(error instanceof Error);
              assert.notEqual(error.message, "");
              assert.doesNotMatch(error.message, RESOLVE_FAIL);
              return true;
            },
          );
        }),
    ],
    [
      "missing loader",
      () =>
        withoutOverride(() => {
          assert.throws(
            () =>
              target.missing.loadGraph({
                cwd: target.root,
                tsconfig: "tsconfig.json",
              }),
            RESOLVE_FAIL,
          );
        }),
    ],
  ];
  for (const [name, run] of cases) {
    try {
      installedTargetBoundary();
      run();
    } catch (error) {
      errors.push(new Error(name, { cause: error }));
    }
  }
  if (errors.length !== 0)
    throw new AggregateError(errors, "installed consumer assertions failed");
}

function withoutOverride(body: () => void): void {
  const previous = process.env.TTSC_GRAPH_BINARY;
  delete process.env.TTSC_GRAPH_BINARY;
  try {
    body();
  } finally {
    if (previous === undefined) delete process.env.TTSC_GRAPH_BINARY;
    else process.env.TTSC_GRAPH_BINARY = previous;
  }
}
