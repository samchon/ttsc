import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  fs,
  os,
  path,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies computeCacheKey ignores Go compiler install path when content
 * matches.
 *
 * Pnpm can materialize the same bundled Go executable through different
 * project-local virtual-store paths. The source-plugin cache key must follow
 * the compiler content, not the install path, so independent pnpm installs can
 * share the global binary cache.
 *
 * 1. Create one source plugin and two fake Go executables with identical content
 *    in different directories.
 * 2. Compute the cache key with each executable path.
 * 3. Assert the keys match.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey matches for two differently located files with the same compiler bytes.
 * @evidence contracts/testing.md#independent-expectations The exact handwritten same go compiler bytes establish content equivalence independently of the cache algorithm.
 * @evidence contracts/testing.md#distinguishing-cases Installation location differs while compiler bytes match; changed compiler identity is owned by the neighboring invalidation case.
 * @evidence contracts/testing.md#execution-ownership The exported test_computecachekey_ignores_go_compiler_install_path_when_content_matches entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The cache identity owner resolves actual tool paths and consumes the Go metadata process result when goBinary is supplied. The handwritten fake producer or intentionally unusable compiler files constrain that connection; these assertions establish identity selection, not native binary compatibility by execution.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. The same source and version inputs remain fixed while the named identity axis changes; each key observes that state through the existing metadata owner, without installing a consumer or compiling a native artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage computeCacheKey matches for two differently located files with the same compiler bytes. These assertions stay in test_computecachekey_ignores_go_compiler_install_path_when_content_matches with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_computecachekey_ignores_go_compiler_install_path_when_content_matches =
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
    const goA = path.join(root, "a", "go");
    const goB = path.join(root, "b", "go");
    fs.mkdirSync(path.dirname(goA), { recursive: true });
    fs.mkdirSync(path.dirname(goB), { recursive: true });
    fs.writeFileSync(goA, "same go compiler\n", "utf8");
    fs.writeFileSync(goB, "same go compiler\n", "utf8");

    const first = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: goA,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    const second = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: goB,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.equal(first, second);
  };
