import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  nativePluginSource,
  spawn,
  ttsxBin,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx executes source plugin output end-to-end.
 *
 * `ttsx` is the typed runtime: it builds the project (including source plugins)
 * and then executes the entry-point file. This test confirms the full chain —
 * source plugin compilation, JS transform, type-check, and Node execution —
 * produces the expected printed output without an intermediate build step.
 *
 * 1. Copy the `go-source-plugin` fixture.
 * 2. Run `ttsx --cwd <root> src/main.ts` with the immutable shared Go producer.
 * 3. Assert zero exit and stdout trimmed to `"PLUGIN"`.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes the real ttsx CLI over a Go-source plugin and requires the transformed literal PLUGIN stdout and zero exit.
 * @evidence contracts/testing.md#independent-expectations The authored goUpper call starts with lowercase plugin; literal uppercase PLUGIN proves native transformation reached the executed output.
 * @evidence contracts/testing.md#distinguishing-cases Owns direct typed-runtime execution of source-plugin output; register's excluded synthetic entry keeps its distinct synthetic-tsconfig boundary.
 * @evidence contracts/testing.md#execution-ownership This named native export is selected once and owns one temporary consumer source/config tree and one real ttsx invocation.
 * @evidence contracts/e2e.md#necessary-boundary Neither descriptor nor runtime-decision units prove Go-source output is compiled and selected by the public typed runtime; stdout observes the actual producer-to-runtime connection.
 * @evidence contracts/e2e.md#shared-execution Uses the canonical immutable compiler-backed runtime source and shared TTSC_CACHE_DIR, sharing the same producer binary with direct go.mod consumers instead of rebuilding consumer-local copies.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer files remain temporary and independent; the canonical Go module is never modified and production source/toolchain/content keys establish artifact reuse validity. This case asserts no cold-build behavior.
 * @evidence contracts/e2e.md#preserved-coverage Keeps both original exit and exact transformed stdout assertions; synthetic-register outside-include behavior, actual cold-build and invalidation assertions remain in their original independent owners.
 */
export function test_plugin_corpus_ttsx_executes_source_plugin_output_end_to_end(): void {
    const root = copyProject("go-source-plugin");
    fs.writeFileSync(path.join(root, "plugin.cjs"), `module.exports = () => ({ name: "go-source-plugin", capabilities: { emitProvenance: true }, source: ${JSON.stringify(nativePluginSource("runtime-source"))} });\n`);
    const cacheDir = SHARED_PLUGIN_CACHE_DIR;
    const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "PLUGIN");
}
