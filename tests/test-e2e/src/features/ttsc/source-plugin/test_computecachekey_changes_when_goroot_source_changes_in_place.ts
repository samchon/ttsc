import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  os,
  path,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies computeCacheKey changes when GOROOT source changes in place.
 *
 * Long-lived programmatic hosts can call `prepare()` or `compile()` more than
 * once in one Node process. If a test or installer patches the effective GOROOT
 * between calls, the pathless toolchain fingerprint must be recomputed from
 * content rather than held in a process-global cache.
 *
 * 1. Create one source plugin, one fake Go executable, and one toolchain root.
 * 2. Compute a cache key, then edit a standard-library source file in place.
 * 3. Assert the next cache key differs.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey changes after stdlib source is rewritten at the same GOROOT in the same process.
 * @evidence contracts/testing.md#independent-expectations Changing alpha to bravo is an independent content mutation, requiring a distinct toolchain identity.
 * @evidence contracts/testing.md#distinguishing-cases Same executable, root and process must not preserve a stale stdlib fingerprint after the edit.
 * @evidence contracts/testing.md#execution-ownership The exported test_computecachekey_changes_when_goroot_source_changes_in_place entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The cache identity owner resolves actual tool paths and consumes the Go metadata process result when goBinary is supplied. The handwritten fake producer or intentionally unusable compiler files constrain that connection; these assertions establish identity selection, not native binary compatibility by execution.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. The same source and version inputs remain fixed while the named identity axis changes; each key observes that state through the existing metadata owner, without installing a consumer or compiling a native artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage computeCacheKey changes after stdlib source is rewritten at the same GOROOT in the same process. These assertions stay in test_computecachekey_changes_when_goroot_source_changes_in_place with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_computecachekey_changes_when_goroot_source_changes_in_place =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    const go = createFakeGoBinary(root);
    const goRoot = path.join(root, "go-root");
    const sourceFile = writeGoRoot(goRoot, "alpha");

    const previous = process.env.FAKE_GO_ENV_GOROOT;
    try {
      process.env.FAKE_GO_ENV_GOROOT = goRoot;
      const first = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      fs.writeFileSync(
        sourceFile,
        'package fmt\nconst marker = "bravo"\n',
        "utf8",
      );
      const second = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      assert.notEqual(first, second);
    } finally {
      if (previous === undefined) delete process.env.FAKE_GO_ENV_GOROOT;
      else process.env.FAKE_GO_ENV_GOROOT = previous;
    }
  };

function writeGoRoot(root: string, marker: string): string {
  fs.mkdirSync(path.join(root, "src", "fmt"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, "pkg", "tool", "linux_amd64"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, "VERSION"), "go1.26.0\n", "utf8");
  fs.writeFileSync(path.join(root, "go.env"), "GOTOOLCHAIN=auto\n", "utf8");
  const sourceFile = path.join(root, "src", "fmt", "print.go");
  fs.writeFileSync(
    sourceFile,
    `package fmt\nconst marker = ${JSON.stringify(marker)}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "src", "runtime", "runtime.go"),
    "package runtime\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "pkg", "tool", "linux_amd64", "compile"),
    "compile\n",
    "utf8",
  );
  return sourceFile;
}
