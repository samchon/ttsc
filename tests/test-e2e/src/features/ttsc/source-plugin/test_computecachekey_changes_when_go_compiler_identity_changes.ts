import { TestProject } from "@ttsc/testing";

import {
  assert,
  computeCacheKey,
  createFakeGoBinary,
  fs,
  path,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies computeCacheKey changes when Go compiler identity changes.
 *
 * A plugin binary built with one version of the Go compiler is not compatible
 * with a binary built by a different version. The cache key must include a
 * content fingerprint of the `go` executable so upgrading the toolchain
 * produces a fresh binary slot in the global plugin cache.
 *
 * 1. Create one source plugin and two fake Go executables with different content.
 * 2. Compute the cache key with each executable as `goBinary`.
 * 3. On POSIX, contrast an empty leading PATH entry with PATH-only lookup.
 * 4. Assert each effective compiler identity receives a distinct key.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey separates changed compiler bytes, same-size same-mtime replacement, and POSIX cwd-first versus PATH-only tool selection.
 * @evidence contracts/testing.md#independent-expectations The two authored tools and replacement comment differ in bytes, while explicit stat checks prove the replacement preserves size and mtime.
 * @evidence contracts/testing.md#distinguishing-cases Different path tools, same-path replacement and empty leading PATH segment retain three identity distinctions; Windows omits the POSIX PATH branch.
 * @evidence contracts/testing.md#execution-ownership The exported test_computecachekey_changes_when_go_compiler_identity_changes entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The cache identity owner resolves actual tool paths and consumes the Go metadata process result when goBinary is supplied. The handwritten fake producer or intentionally unusable compiler files constrain that connection; these assertions establish identity selection, not native binary compatibility by execution.
 * @evidence contracts/e2e.md#shared-execution One case-local source/workspace and tool fixture supplies all observations in this named case; the suite built libraries are reused. The same source and version inputs remain fixed while the named identity axis changes; each key observes that state through the existing metadata owner, without installing a consumer or compiling a native artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns temporary directories through process exit. Any ambient environment writes are restored by the case's finally block; explicit environments remain call-local. Case-local toolchain/source identities keep memoized readings and publication paths separate from other cases.
 * @evidence contracts/e2e.md#preserved-coverage computeCacheKey separates changed compiler bytes, same-size same-mtime replacement, and POSIX cwd-first versus PATH-only tool selection. These assertions stay in test_computecachekey_changes_when_go_compiler_identity_changes with their original fixture inputs and failure identity; no assertion has been transferred to a claimed but unexecuted semantic owner.
 */
export const test_computecachekey_changes_when_go_compiler_identity_changes =
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
    const goA = path.join(root, "go-a");
    const goB = path.join(root, "go-b");
    fs.writeFileSync(goA, "go compiler a\n", "utf8");
    fs.writeFileSync(goB, "go compiler b\n", "utf8");

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

    assert.notEqual(first, second);

    const replacedGo = createFakeGoBinary(root);
    fs.appendFileSync(
      replacedGo,
      process.platform === "win32" ? "\r\nrem a\r\n" : "\n# a\n",
      "utf8",
    );
    const fixedTime = new Date(Math.floor(Date.now() / 1_000) * 1_000);
    fs.utimesSync(replacedGo, fixedTime, fixedTime);
    const replacedBefore = fs.statSync(replacedGo, { bigint: true });
    const beforeReplacement = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: replacedGo,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    const replacement = `${replacedGo}.replacement`;
    fs.writeFileSync(
      replacement,
      fs.readFileSync(replacedGo, "utf8").replace(/a(\r?\n)$/, "b$1"),
      "utf8",
    );
    fs.utimesSync(replacement, fixedTime, fixedTime);
    fs.renameSync(replacement, replacedGo);
    const replacedAfter = fs.statSync(replacedGo, { bigint: true });
    assert.equal(replacedAfter.size, replacedBefore.size);
    assert.equal(replacedAfter.mtimeNs, replacedBefore.mtimeNs);
    const afterReplacement = computeCacheKey({
      dir: plugin,
      entry: ".",
      goBinary: replacedGo,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    assert.notEqual(beforeReplacement, afterReplacement);

    if (process.platform === "win32") return;
    const cwdGo = createFakeGoBinary(plugin);
    fs.renameSync(cwdGo, path.join(plugin, "go"));
    const pathToolchain = path.join(root, "path-toolchain");
    fs.mkdirSync(pathToolchain, { recursive: true });
    const pathGo = createFakeGoBinary(pathToolchain);
    fs.renameSync(pathGo, path.join(pathToolchain, "go"));

    const cwdFirst = computeCacheKey({
      dir: plugin,
      entry: ".",
      env: { ...process.env, PATH: `${path.delimiter}${pathToolchain}` },
      goBinary: "go",
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    const pathOnly = computeCacheKey({
      dir: plugin,
      entry: ".",
      env: { ...process.env, PATH: pathToolchain },
      goBinary: "go",
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    assert.notEqual(cwdFirst, pathOnly);
  };
