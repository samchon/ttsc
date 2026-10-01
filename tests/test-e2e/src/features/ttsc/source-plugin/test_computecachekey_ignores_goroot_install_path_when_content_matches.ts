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
 * Verifies computeCacheKey ignores GOROOT install path when content matches.
 *
 * Pnpm can expose the same bundled Go SDK through different virtual-store
 * paths. The GOROOT contribution to the shared plugin cache key must follow
 * build-relevant toolchain content, not the absolute install directory.
 *
 * 1. Create one source plugin and a fake Go executable.
 * 2. Point effective `GOROOT` at two identical toolchain roots in different paths.
 * 3. Assert the cache keys match.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey matches for two independently authored identical toolchain roots in different directories.
 * @evidence contracts/testing.md#independent-expectations Equal build-relevant VERSION, go.env, stdlib and compiler bytes establish equivalent toolchain content.
 * @evidence contracts/testing.md#distinguishing-cases Only installation path changes; changed-content roots are the complementary rejection cases.
 * @evidence contracts/testing.md#execution-ownership The exported test_computecachekey_ignores_goroot_install_path_when_content_matches entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The cache identity owner resolves actual tool paths and consumes the Go metadata process result when goBinary is supplied. The handwritten fake producer or intentionally unusable compiler files constrain that connection; these assertions establish identity selection, not native binary compatibility by execution.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. The same source and version inputs remain fixed while the named identity axis changes; each key observes that state through the existing metadata owner, without installing a consumer or compiling a native artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage computeCacheKey matches for two independently authored identical toolchain roots in different directories. These assertions stay in test_computecachekey_ignores_goroot_install_path_when_content_matches with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_computecachekey_ignores_goroot_install_path_when_content_matches =
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
    const goRootA = path.join(root, "a", "go");
    const goRootB = path.join(root, "b", "go");
    writeGoRoot(goRootA);
    writeGoRoot(goRootB);

    const previous = process.env.FAKE_GO_ENV_GOROOT;
    try {
      process.env.FAKE_GO_ENV_GOROOT = goRootA;
      const first = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      process.env.FAKE_GO_ENV_GOROOT = goRootB;
      const second = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      assert.equal(first, second);
    } finally {
      if (previous === undefined) delete process.env.FAKE_GO_ENV_GOROOT;
      else process.env.FAKE_GO_ENV_GOROOT = previous;
    }
  };

function writeGoRoot(root: string): void {
  fs.mkdirSync(path.join(root, "src", "fmt"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "runtime"), { recursive: true });
  fs.mkdirSync(path.join(root, "pkg", "tool", "linux_amd64"), {
    recursive: true,
  });
  fs.writeFileSync(path.join(root, "VERSION"), "go1.26.0\n", "utf8");
  fs.writeFileSync(path.join(root, "go.env"), "GOTOOLCHAIN=auto\n", "utf8");
  fs.writeFileSync(
    path.join(root, "src", "fmt", "print.go"),
    'package fmt\nconst marker = "same"\n',
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
}
