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
 * Compiler-content changes must invalidate source-plugin cache identity.
 * The cache key includes a
 * content fingerprint of the `go` executable so upgrading the toolchain
 * produces a fresh binary slot in the global plugin cache.
 *
 * 1. Create one source plugin and compiler files with changed and equal bytes.
 * 2. Compare different content and equal content at distinct installation paths.
 * 3. On POSIX, contrast an empty leading PATH entry with PATH-only lookup.
 * 4. Assert changed bytes and selected tools differ while equal relocated bytes agree.
 *
 * @evidence contracts/testing.md#behavioral-verification computeCacheKey separates changed compiler bytes, same-size same-mtime replacement, and POSIX cwd-first versus PATH-only tool selection; relocating equal compiler bytes preserves the key.
 * @evidence contracts/testing.md#independent-expectations Handwritten compiler-a bytes match at two distinct paths while compiler-b bytes differ; explicit stat checks establish replacement size and mtime equality. Replacement execute mode is not explicitly preserved, so this is not a byte-only runnable-tool comparison.
 * @evidence contracts/testing.md#distinguishing-cases Equal relocated bytes are the positive twin to different compiler bytes. Same-path replacement and an empty leading PATH segment retain their original distinctions; Windows omits only the POSIX PATH branch after the other assertions execute.
 * @evidence contracts/testing.md#execution-ownership The exported test_computecachekey_changes_when_go_compiler_identity_changes entry is discovered by TestExecutor from features/ttsc/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary The cache identity owner resolves actual tool paths and consumes the Go metadata process result when goBinary is supplied. The handwritten fake producer or intentionally unusable compiler files constrain that connection; these assertions establish identity selection, not native binary compatibility by execution.
 * @evidence contracts/e2e.md#shared-execution Changed and relocated-equal compiler assertions share one source module and the first observed key, replacing two previous source roots with one and four key calls with three for this byte/path matrix. These static call counts are not actual child population or measured cost reductions. Independent byte, replacement and POSIX groups collect named failures. Replacement and POSIX lookup retain their separate original calls; no consumer is installed or native artifact compiled.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked root is retained before preparation. There are no ambient writes; PATH overrides are call-local. Equal-byte tools share the source, while replacement changes the selected path entry. Windows still returns after the five earlier key requests and reports any collected failures; its POSIX branch remains unobserved. Synchronous results do not certify descendant closure or loaded-image identity.
 * @evidence contracts/e2e.md#preserved-coverage The former install-path test's equal-byte relocation assertion now shares this actual metadata owner with changed-byte, same-size same-mtime replacement and POSIX lookup assertions. Equal authored bytes remain equal at different paths, differing bytes remain different, and every original replacement stat and lookup assertion remains.
 */
export const test_computecachekey_changes_when_go_compiler_identity_changes =
  () => {
    const root = TestProject.tmpdir("ttsc-source-plugin-");
    TestProject.retainTemporaryDirectory(root);
    const plugin = path.join(root, "plugin");
    fs.mkdirSync(plugin, { recursive: true });
    fs.writeFileSync(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
      "utf8",
    );
    fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
    const failures: Error[] = [];
    try {
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

      const relocatedGo = path.join(root, "relocated", "go-a");
      fs.mkdirSync(path.dirname(relocatedGo), { recursive: true });
      fs.writeFileSync(relocatedGo, "go compiler a\n", "utf8");
      const relocated = computeCacheKey({
        dir: plugin,
        entry: ".",
        goBinary: relocatedGo,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
      assert.equal(relocated, first);
    } catch (error) {
      failures.push(new Error("changed and relocated compiler bytes", { cause: error }));
    }

    try {
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
    } catch (error) {
      failures.push(new Error("same-path compiler replacement", { cause: error }));
    }

    if (process.platform === "win32") {
      if (failures.length !== 0)
        throw new AggregateError(failures, "Compiler identity observations failed");
      return;
    }
    try {
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
    } catch (error) {
      failures.push(new Error("POSIX cwd and PATH tool selection", { cause: error }));
    }

    if (failures.length !== 0)
      throw new AggregateError(failures, "Compiler identity observations failed");
  };
