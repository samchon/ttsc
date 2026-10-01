import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  os,
  path,
} from "../../internal/source-build";

/**
 * Verifies computeCacheKey changes when external tool identity changes.
 *
 * Cgo-capable builds can resolve `CC`, `CXX`, `AR`, and `PKG_CONFIG` through
 * PATH even when Go's effective env value is only a command name like `gcc`.
 * The cache key must include the resolved tool content, or two shells with the
 * same `CC` value but different PATH entries can share an incompatible binary.
 *
 * 1. Create one source plugin and two same-named fake C compiler binaries.
 * 2. Compute a cache key with PATH resolving the first compiler.
 * 3. Point PATH at the second compiler and assert the key changes.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey changes when identical CC command names resolve through PATH to different compiler content.
 * @evidence contracts/testing.md#independent-expectations The two handwritten mycc files contain alpha and bravo, so build-relevant tool identities differ despite equal CC text.
 * @evidence contracts/testing.md#distinguishing-cases Same command name with distinct PATH selection tests external tool resolution; this case does not compile C code.
 * @evidence contracts/testing.md#execution-ownership The exported test_computecachekey_changes_when_external_tool_identity_changes entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The cache identity owner resolves actual tool paths and consumes the Go metadata process result when goBinary is supplied. The handwritten fake producer or intentionally unusable compiler files constrain that connection; these assertions establish identity selection, not native binary compatibility by execution.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. The same source and version inputs remain fixed while the named identity axis changes; each key observes that state through the existing metadata owner, without installing a consumer or compiling a native artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage computeCacheKey changes when identical CC command names resolve through PATH to different compiler content. These assertions stay in test_computecachekey_changes_when_external_tool_identity_changes with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_computecachekey_changes_when_external_tool_identity_changes =
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
    const toolName = process.platform === "win32" ? "mycc.exe" : "mycc";
    const firstToolDir = writeTool(root, "first", toolName, "alpha");
    const secondToolDir = writeTool(root, "second", toolName, "bravo");

    const previousCc = process.env.FAKE_GO_ENV_CC;
    const previousPath = process.env.PATH;
    try {
      process.env.FAKE_GO_ENV_CC = toolName;
      process.env.PATH = [firstToolDir, previousPath ?? ""]
        .filter((part) => part !== "")
        .join(path.delimiter);
      const first = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      process.env.PATH = [secondToolDir, previousPath ?? ""]
        .filter((part) => part !== "")
        .join(path.delimiter);
      const second = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: go,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });

      assert.notEqual(first, second);
    } finally {
      if (previousCc === undefined) delete process.env.FAKE_GO_ENV_CC;
      else process.env.FAKE_GO_ENV_CC = previousCc;
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
    }
  };

function writeTool(
  root: string,
  name: string,
  toolName: string,
  content: string,
): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, toolName), content, "utf8");
  return dir;
}
