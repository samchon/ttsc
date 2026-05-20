import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  goPath,
  os,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint clean project exits zero.
 *
 * This is the green-path sanity test for the full @ttsc/lint pipeline. When no
 * rule violations are present the lint sidecar must signal success so ttsc
 * exits 0. A false positive here would make every clean project appear broken.
 *
 * 1. Copy the `lint-violations` fixture and overwrite `src/main.ts` with a source
 *    file that has no lint violations.
 * 2. Run ttsc with `--noEmit`.
 * 3. Assert zero exit.
 */
export const test_plugin_corpus_ttsc_lint_clean_project_exits_zero = () => {
  const root = setupLintProject("lint-violations");
  // Replace the violating source with a clean file.
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "hi";\nconst _value: number = value.length;\nvoid _value;\n`,
  );
  const cacheDir = TestProject.tmpdir("ttsc-lint-clean-");
  const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.status, 0, result.stderr);
};
