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
 * Verifies plugin corpus: source plugin bootstraps a Program and Checker
 * against the consumer tsconfig.
 *
 * The Go sidecar receives a `--tsconfig` path and must initialise a
 * TypeScript-Go Program+Checker from it before calling plugin handlers. This
 * test confirms the plumbing works end-to-end: the `go-source-plugin-checker`
 * fixture introspects interface property types through the Checker and emits
 * them into the JS output.
 *
 * 1. Copy the `go-source-plugin-checker` fixture which reads type info via the
 *    Checker and emits interface property names/types as strings.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit, a build log entry, and `"User"` plus `"string[]"` in the
 *    emitted JS (proving the Checker resolved real type symbols).
 */
export const test_plugin_corpus_source_plugin_bootstraps_a_program_and_checker_against_the_consumer_tsconfig =
  () => {
    const root = copyProject("go-source-plugin-checker");
    const cacheDir = TestProject.tmpdir("ttsc-source-plugin-checker-");
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
      /building source plugin "go-source-plugin-checker"/,
    );
    const out = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(out, /"User"/);
    assert.match(out, /"string\[\]"/);
  };
