import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttsxBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx executes source plugin output end-to-end.
 *
 * `ttsx` is the typed runtime: it builds the project (including source plugins)
 * and then executes the entry-point file. This test confirms the full chain —
 * source plugin compilation, JS transform, type-check, and Node execution —
 * produces the expected printed output without an intermediate build step.
 *
 * 1. Copy the `go-source-plugin` fixture.
 * 2. Run `ttsx --cwd <root> src/main.ts` (no prior cache).
 * 3. Assert zero exit and stdout trimmed to `"PLUGIN"`.
 */
export const test_plugin_corpus_ttsx_executes_source_plugin_output_end_to_end =
  () => {
    const root = copyProject("go-source-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-ttsx-");
    const result = spawn(ttsxBin, ["--cwd", root, "src/main.ts"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "PLUGIN");
  };
