import { TestProject } from "@ttsc/testing";

import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: source plugin walks AST and uses Checker to enumerate
 * interface properties.
 *
 * Plugins can call the TypeScript-Go Checker to resolve type symbols and
 * enumerate their members. This test uses the `go-source-plugin-properties`
 * fixture, which walks the AST for interface declarations and emits their
 * property names into the output JS — proving the full shim API is reachable
 * from a user-authored Go plugin.
 *
 * 1. Copy the `go-source-plugin-properties` fixture.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit and that the emitted JS contains both
 *    `["id","email","name"]` and `["sku","price"]`.
 */
export const test_plugin_corpus_source_plugin_walks_ast_uses_checker_to_enumerate_interface_properties =
  () => {
    const root = copyProject("go-source-plugin-properties");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-properties-");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: cacheDir,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stderr,
      /building source plugin "go-source-plugin-properties"/,
    );
    const out = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(out, /\["id","email","name"\]/);
    assert.match(out, /\["sku","price"\]/);
  };
