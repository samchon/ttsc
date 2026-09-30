import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey changes when GOROOT changes.
 *
 * The plugin builder honors a user-provided GOROOT instead of replacing it with
 * the bundled toolchain root. Since that can change the standard library and
 * tools used by `go build`, the shared global cache must keep distinct slots
 * for different GOROOT values.
 *
 * 1. Create one source plugin and one fake Go executable.
 * 2. Compute the cache key with two different GOROOT values.
 * 3. Assert the keys differ.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey differs for two explicit unresolved GOROOT paths.
 * @evidence contracts/testing.md#independent-expectations An unresolved toolchain root cannot be treated as the same known identity; different literal roots establish the negative identity inputs.
 * @evidence contracts/testing.md#distinguishing-cases Unavailable roots retain distinct fallback identity; existing equal-content root cases own path-independent reuse.
 * @evidence contracts/testing.md#execution-ownership The exported test_computecachekey_changes_when_goroot_changes entry is discovered by TestExecutor from source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The cache identity owner resolves actual tool paths and consumes the Go metadata process result when goBinary is supplied. The handwritten fake producer or intentionally unusable compiler files constrain that connection; these assertions establish identity selection, not native binary compatibility by execution.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. The same source and version inputs remain fixed while the named identity axis changes; each key observes that state through the existing metadata owner, without installing a consumer or compiling a native artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage computeCacheKey differs for two explicit unresolved GOROOT paths. These assertions stay in test_computecachekey_changes_when_goroot_changes with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_computecachekey_changes_when_goroot_changes = () => {
  const root = TestProject.tmpdir("ttsc-source-plugin-");
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
  const go = path.join(root, "go");
  fs.writeFileSync(go, "go compiler\n", "utf8");

  const previous = process.env.GOROOT;
  try {
    process.env.GOROOT = path.join(root, "go-root-a");
    const first = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: go,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    process.env.GOROOT = path.join(root, "go-root-b");
    const second = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: go,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.notEqual(first, second);
  } finally {
    if (previous === undefined) delete process.env.GOROOT;
    else process.env.GOROOT = previous;
  }
};
