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
 * Verifies plugin corpus: source path searches at most three parents for
 * go.mod.
 *
 * When `source` points at a deeply nested sub-directory, ttsc walks up at most
 * three parent levels looking for `go.mod`. The limit prevents runaway
 * filesystem traversal on deep monorepo trees and forces authors to point
 * `source` closer to the module root. Exceeding the limit must produce a clear
 * error naming the depth constraint.
 *
 * 1. Copy the `go-source-plugin` fixture and create a four-level-deep directory
 *    (`go-plugin/a/b/c/d`); rewrite `plugin.cjs` to point `source` at `d`.
 * 2. Run ttsc with `--emit`.
 * 3. Assert non-zero exit and `go.mod within 3 parent directories` in stderr.
 */
export const test_plugin_corpus_source_path_searches_at_most_three_parents_for_go_mod =
  () => {
    const root = copyProject("go-source-plugin");
    const tooDeep = path.join(root, "go-plugin", "a", "b", "c", "d");
    fs.mkdirSync(tooDeep, { recursive: true });
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      `const path = require("node:path");
module.exports = (context) => ({
  name: "go-source-plugin-too-deep",
  source: path.resolve(context.dirname, "go-plugin", "a", "b", "c", "d"),
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
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /go\.mod within 3 parent directories/);
  };
