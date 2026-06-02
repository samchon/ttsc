import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  copyProject,
  goPath,
  spawn,
  ttsxBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx restores CommonJS source import bindings.
 *
 * Native transforms can emit CommonJS that keeps a source-level identifier
 * after TypeScript has rewritten the corresponding import to a `require()`
 * alias. This locks the runtime shim that reconnects named/default source
 * bindings without redeclaring names the plugin output already owns.
 *
 * 1. Copy a source-plugin fixture that emits `new Calc()` and `new
 *    DefaultCounter()` from CommonJS output.
 * 2. Run `ttsx --cwd <root> src/main.ts`.
 * 3. Assert it prints the computed value and the plugin-owned shadow binding.
 */
export const test_plugin_corpus_ttsx_restores_commonjs_source_import_bindings_for_plugin_output =
  () => {
    const root = copyProject("go-source-plugin-source-bindings");
    const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "23:plugin-local");
  };
