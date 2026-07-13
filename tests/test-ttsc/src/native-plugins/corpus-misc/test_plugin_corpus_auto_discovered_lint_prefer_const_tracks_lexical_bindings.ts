import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  goPath,
  parseDiagnostics,
  parseExpectations,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies auto-discovered lint prefer-const tracks lexical bindings.
 *
 * The issue reproduction intentionally has no tsconfig `plugins` entry. The
 * package-level auto-plugin path must still run the native rule and produce the
 * three ESLint-default findings without suppressing same-spelled siblings.
 *
 * 1. Copy the strict NodeNext fixture with @ttsc/lint as a dev dependency.
 * 2. Run the real ttsc CLI with no explicit transform plugin configuration.
 * 3. Compare all prefer-const diagnostics with the annotated three findings.
 */
export const test_plugin_corpus_auto_discovered_lint_prefer_const_tracks_lexical_bindings =
  () => {
    const root = setupLintProject("lint-prefer-const-lexical");
    const source = path.join(root, "src", "case.ts");

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });

    assert.notEqual(result.status, 0, "expected prefer-const diagnostics");
    assert.deepEqual(
      parseDiagnostics(result.stderr, source),
      parseExpectations(source),
      result.stderr,
    );
  };
