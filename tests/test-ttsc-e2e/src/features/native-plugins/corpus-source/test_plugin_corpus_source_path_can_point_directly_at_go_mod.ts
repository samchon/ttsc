import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  __dirname,
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  nativePluginSource,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source path can point directly at go.mod.
 *
 * Authors may prefer to reference the `go.mod` file rather than its parent
 * directory. The source-path resolver must normalise a `go.mod` file path to
 * its containing directory so the `go build` invocation targets the module
 * root.
 *
 * 1. Copy the `go-source-plugin` fixture and overwrite `plugin.cjs` so that
 *    `source` points at the canonical producer's `go.mod` file.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit and `"PLUGIN"` in the emitted JS.
 *
 * @evidence contracts/testing.md#behavioral-verification Real ttsc compiles a descriptor whose source is a go.mod file and requires native uppercase PLUGIN emission with zero exit.
 * @evidence contracts/testing.md#independent-expectations The file-valued source and literal uppercase emitted value distinguish successful owning-module normalization from an untransformed source or directory-only resolver.
 * @evidence contracts/testing.md#distinguishing-cases Owns actual descriptor file-source to native builder assembly; the authored module-resolution unit checks exact manifest/directory identity, nearest module and depth boundaries without a compiler.
 * @evidence contracts/testing.md#execution-ownership This named corpus-source export owns one consumer project and one CLI invocation, selected once by the native boundary runner.
 * @evidence contracts/e2e.md#necessary-boundary The module resolver unit cannot observe its file-source identity passing through descriptor loading and native compilation to final output publication; this verifies that real connection.
 * @evidence contracts/e2e.md#shared-execution Uses the same canonical immutable actual compiler producer and TTSC_CACHE_DIR as runtime consumers; go.mod and directory spellings normalize to the same actual module build identity.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer TypeScript and plugin config remain independent temporary files; only immutable producer source is shared and production module/toolchain keys govern reuse, with no asserted cold-build state hidden.
 * @evidence contracts/e2e.md#preserved-coverage Keeps both original CLI success and uppercase emitted JavaScript assertions; exact source selection is additionally owned by the source unit, and native cold-build/invalidation tests retain their own independent caches. TestSourceSDKProgramChecker preserves the original User/string[] source through real Program/source lookup/Checker type queries, TestSourceSDKInterfaceProperties preserves both original sources and exact ordered User/Product arrays through AST and Checker, and TestSourceSDKFactoryPrinter preserves original TSGO (tsgo) output through the real factory/printer. These direct SDK owners run in one Go unit process; this unchanged compiler-backed producer imports and links the actual compiler/AST/printer shims and preserves their generic source-build and host/output connection without claiming to execute those removed fixture-specific sources.
 */
export function test_plugin_corpus_source_path_can_point_directly_at_go_mod(): void {
    const root = copyProject("go-source-plugin");
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      `const path = require("node:path");
module.exports = (context) => ({
  name: "go-source-plugin",
  capabilities: { emitProvenance: true },
  source: ${JSON.stringify(path.join(nativePluginSource("runtime-source"), "go.mod"))},
});
`,
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN"/,
    );
}
