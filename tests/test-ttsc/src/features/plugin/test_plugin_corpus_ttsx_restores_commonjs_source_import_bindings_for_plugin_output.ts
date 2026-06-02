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
 * alias. This locks the runtime shim that reconnects named/default/namespace
 * source bindings without redeclaring names the plugin output already owns or
 * trusting commented-out `require()` calls.
 *
 * 1. Copy a source-plugin fixture that emits `new Calc()` and `new
 *    DefaultCounter()` from CommonJS output plus namespace/default+named
 *    adjacent cases.
 * 2. Run `ttsx --cwd <root> src/main.ts`.
 * 3. Assert it prints restored values, the plugin-owned shadow binding, and an
 *    unresolved comment-only import.
 */
export const test_plugin_corpus_ttsx_restores_commonjs_source_import_bindings_for_plugin_output =
  () => {
    const root = copyProject("go-source-plugin-source-bindings");
    const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "72:plugin-local:undefined:true");
  };
