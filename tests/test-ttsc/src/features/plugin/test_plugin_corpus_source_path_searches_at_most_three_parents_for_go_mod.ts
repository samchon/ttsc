import { TestProject } from "@ttsc/testing";

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
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_source_path_searches_at_most_three_parents_for_go_mod =
  () => {
    const root = copyProject("go-source-plugin");
    const tooDeep = path.join(root, "go-plugin", "a", "b", "c", "d");
    fs.mkdirSync(tooDeep, { recursive: true });
    fs.writeFileSync(
      path.join(root, "plugin.cjs"),
      `const path = require("node:path");
module.exports = {
  name: "go-source-plugin-too-deep",
  source: path.resolve(__dirname, "go-plugin", "a", "b", "c", "d"),
};
`,
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-source-plugin-too-deep-"),
      },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /go\.mod within 3 parent directories/);
  };
