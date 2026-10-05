import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  commonJsProject,
  fs,
  goPath,
  os,
  path,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint fix rewrites source before final check.
 *
 * This pins the user-facing `ttsc fix` path, not just the native sidecar. The
 * launcher must route fix mode to check-stage plugins, and the lint sidecar
 * must reload the project before reporting remaining diagnostics.
 *
 * 1. Materialize a project with fixable native lint violations and a
 *    `lint.config.json` enabling the offending rules.
 * 2. Run `ttsc fix` through the real launcher and source-plugin cache.
 * 3. Assert the source file is rewritten and no JavaScript output is emitted.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsc fix rewrites var, never-reassigned let and loose equality to the exact fixed source while dist/main.js remains absent; other possible output paths are not enumerated.
 * @evidence contracts/testing.md#independent-expectations The literal expected const declarations and strict equality follow the configured rules, independently of the launcher or fix implementation.
 * @evidence contracts/testing.md#distinguishing-cases Owns fix dispatch and reload after edits; format-only dispatch is checked separately, and untouched source meaning remains in the exact output string.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named corpus-ttsc export in the generic E2E population. The public launcher uses the explicit workspace lint junction, not a packed installation or an independently selected Linux-only entry.
 * @evidence contracts/e2e.md#necessary-boundary The launcher must send fix to the check-stage producer, preserve its file edits and finish against the rewritten project; direct fixer units do not establish that connection.
 * @evidence contracts/e2e.md#shared-execution The unchanged lint producer and explicit suite-owned shared cache are available for reuse. The original selected Go path or PATH fallback remains an input; its spelling is not executable-byte equality and output does not certify a cache hit, total preparations or minimum process cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked consumer owns editable source/config and initially absent dist/main.js; the input differs from the expected rewritten file before launch. Error, signal and exit status are checked before consuming edits. Synchronous return does not certify arbitrary descendants or loaded-image equality; suite cache/workspace producer are not consumer cleanup targets.
 * @evidence contracts/e2e.md#preserved-coverage Original success status, exact complete rewritten file and absent dist/main.js remain in this boundary; this case does not certify unrelated fix rule semantics.
 */
export function test_plugin_corpus_ttsc_lint_fix_rewrites_source_before_final_check(): void {
  const root = commonJsProject(
    FixtureFiles.read(
      "ttsc/plugin_corpus_ttsc_lint_fix_rewrites_source_before_final_check/inputs-1",
    ),
    {
      compilerOptions: {
        plugins: [{ transform: "@ttsc/lint" }],
      },
    },
  );
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  assert.notEqual(
    fs.readFileSync(path.join(root, "src", "main.ts"), "utf8"),
    'const legacy = 1;\nconst stable = legacy;\nif (typeof stable === "number") { JSON.stringify(stable); }\n',
  );
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  fs.symlinkSync(
    path.join(workspaceRoot, "packages", "lint"),
    path.join(linkDir, "lint"),
    "junction",
  );

  const goBinary = path.join(os.homedir(), "go-sdk", "go", "bin", "go");
  const result = spawn(ttscBin, ["fix", "--cwd", root], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      TTSC_GO_BINARY: fs.existsSync(goBinary) ? goBinary : "go",
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    fs.readFileSync(path.join(root, "src", "main.ts"), "utf8"),
    'const legacy = 1;\nconst stable = legacy;\nif (typeof stable === "number") { JSON.stringify(stable); }\n',
  );
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
}
