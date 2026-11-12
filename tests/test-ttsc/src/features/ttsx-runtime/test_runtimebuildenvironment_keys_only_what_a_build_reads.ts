import assert from "node:assert/strict";

import { runtimeBuildEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/build/runtimeBuildEnvironment";
import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";

/**
 * Verifies a runtime build is keyed by the variables its processes read, so an
 * invocation's own noise cannot make every completed emit unfindable.
 *
 * A package manager exports the script's arguments, a shell its session and CI
 * its run number. A key over the whole environment changed with each of them
 * (samchon/ttsc#1852).
 *
 * 1. Project a baseline environment.
 * 2. Add variables no build process reads and require an equal projection.
 * 3. Change each variable a build process does read and require a different one.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production projection with authored environments and compares its complete serialized rows, so an added or dropped variable is observed directly.
 * @evidence contracts/testing.md#independent-expectations The expectation is equality or inequality with the baseline, decided by which process documents reading the variable: the package-manager and session names are read by none, the listed ones by ttsc, Node helpers or the compiler's color decision.
 * @evidence contracts/testing.md#distinguishing-cases Unread variables, each reader's variable, per-run channels and reporting switches of ttsc's own namespace, color forced and color refused, and a terminal session that matters only under forced color separate presence from being read.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export and calls one pure function on plain objects merged by the production environment owner; the process environment is neither read nor replaced.
 */
export function test_runtimebuildenvironment_keys_only_what_a_build_reads(): void {
  const project = (extra: NodeJS.ProcessEnv): string =>
    JSON.stringify(
      runtimeBuildEnvironment(
        SidecarEnvironment.merge(
          { PATH: "/usr/bin", HOME: "/home/dev", TTSC_TSGO_BINARY: "/tsc" },
          extra,
        ),
      ),
    );
  const baseline = project({});
  const failures: Error[] = [];
  const expect = (label: string, same: boolean, extra: NodeJS.ProcessEnv) => {
    try {
      assert.equal(project(extra) === baseline, same, label);
    } catch (cause) {
      failures.push(new Error(label, { cause }));
    }
  };

  // Read by no build process: the invocation describing itself.
  expect("script arguments", true, {
    npm_lifecycle_script: "ttsx src/main.ts --list",
    npm_lifecycle_event: "cap",
    INIT_CWD: "/work/apps/cap",
  });
  expect("terminal session", true, { WT_SESSION: "7f3c", TERM: "xterm" });
  expect("ci run", true, { GITHUB_RUN_ID: "42", CI: "true" });
  expect("unrelated user variable", true, { MY_FEATURE_FLAG: "1" });

  // Per-run channels and reporting switches of ttsc's own namespace.
  expect("run manifest", true, { TTSX_RUNTIME_MANIFEST: "/runs/1/manifest" });
  expect("cache explanation", true, { TTSC_EXPLAIN_CACHE: "1" });
  expect("trace sink", true, { TTSC_E2E_TRACE: "/trace" });

  // Read by ttsc, by a plugin's Node helper, or by the compiler.
  expect("compiler selection", false, { TTSC_TSGO_BINARY: "/other/tsc" });
  expect("plugin configuration anchor", false, {
    TTSC_PLUGIN_CONFIG_DIR: "/work",
  });
  expect("helper startup options", false, { NODE_OPTIONS: "--no-warnings" });
  expect("helper module path", false, { NODE_PATH: "/modules" });
  expect("forced color", false, { FORCE_COLOR: "1" });

  // Color refused wins over color forced, and a terminal's capabilities are
  // consulted only once color is on.
  expect("refused color", true, { FORCE_COLOR: "1", NO_COLOR: "1" });
  try {
    assert.notEqual(
      project({ FORCE_COLOR: "1" }),
      project({ FORCE_COLOR: "1", WT_SESSION: "7f3c" }),
    );
    assert.equal(
      project({ FORCE_COLOR: "1", WT_SESSION: "7f3c" }),
      project({ FORCE_COLOR: "1", WT_SESSION: "another-tab" }),
    );
  } catch (cause) {
    failures.push(
      new Error("terminal capability under forced color", { cause }),
    );
  }
  if (failures.length)
    throw new AggregateError(failures, "runtime build environment projection");
}
