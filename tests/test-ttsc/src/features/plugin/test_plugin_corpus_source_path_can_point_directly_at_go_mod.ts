import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  __dirname,
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
 * Verifies plugin corpus: source path can point directly at go.mod.
 *
 * Authors may prefer to reference the `go.mod` file rather than its parent
 * directory. The source-path resolver must normalise a `go.mod` file path to
 * its containing directory so the `go build` invocation targets the module
 * root.
 *
 * 1. Copy the `go-source-plugin` fixture and overwrite `plugin.cjs` so that
 *    `source` points at `go-plugin/go.mod` (a file, not a directory).
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit and `"PLUGIN"` in the emitted JS.
 */
export const test_plugin_corpus_source_path_can_point_directly_at_go_mod =
  () => {
    const root = copyProject("go-source-plugin");
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      `const path = require("node:path");
module.exports = (context) => ({
  name: "go-source-plugin",
  source: path.resolve(context.dirname, "go-plugin", "go.mod"),
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
  };
