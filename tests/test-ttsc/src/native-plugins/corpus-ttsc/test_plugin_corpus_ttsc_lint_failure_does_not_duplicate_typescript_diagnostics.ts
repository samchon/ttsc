import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint failure does not duplicate TypeScript
 * diagnostics.
 *
 * `@ttsc/lint` reports normal Program diagnostics together with its own rule
 * findings. The post-failure TypeScript guard must recognize that TS2322 is
 * already present and avoid appending the same diagnostic a second time while
 * preserving the lint failures in the shared stream.
 *
 * 1. Copy the lint-violations fixture and add a genuine TS2322 assignment.
 * 2. Run ttsc with `--noEmit` so @ttsc/lint reports both diagnostic families.
 * 3. Assert lint output remains present and TS2322 occurs exactly once.
 */
export const test_plugin_corpus_ttsc_lint_failure_does_not_duplicate_typescript_diagnostics =
  () => {
    const root = setupLintProject("lint-violations");
    fs.appendFileSync(
      path.join(root, "src", "main.ts"),
      '\nconst wrong: number = "type-error";\nvoid wrong;\n',
      "utf8",
    );
    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /\[no-var\]/);
    assert.equal(result.stderr.match(/TS2322/g)?.length, 1, result.stderr);
  };
