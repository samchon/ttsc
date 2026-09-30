import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
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
} from "../../internal/plugin-corpus";

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
 * @evidence contracts/testing.md#behavioral-verification Actual ttsc fix rewrites var, never-reassigned let and loose equality to the exact fixed source without emitting JavaScript.
 * @evidence contracts/testing.md#independent-expectations The literal expected const declarations and strict equality follow the configured rules, independently of the launcher or fix implementation.
 * @evidence contracts/testing.md#distinguishing-cases Owns fix dispatch and reload after edits; format-only dispatch is checked separately, and untouched source meaning remains in the exact output string.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-ttsc export invokes the actual installed launcher and lint fix command in the Linux native batch.
 * @evidence contracts/e2e.md#necessary-boundary The launcher must send fix to the check-stage producer, preserve its file edits and finish against the rewritten project; direct fixer units do not establish that connection.
 * @evidence contracts/e2e.md#shared-execution The same immutable lint producer uses the batch plugin cache and Go objects; this project is separate because fix deliberately mutates its source.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project owns its editable source/config and separate output directory, so earlier format or check cases cannot determine its result; reused artifacts contain no consumer source.
 * @evidence contracts/e2e.md#preserved-coverage Original success status, exact complete rewritten file and absent dist/main.js remain in this boundary; this case does not certify unrelated fix rule semantics.
 */
export function test_plugin_corpus_ttsc_lint_fix_rewrites_source_before_final_check(): void {
  const root = commonJsProject(
    {
      "src/main.ts": `var legacy = 1;\nlet stable = legacy;\nif (typeof stable == "number") { JSON.stringify(stable); }\n`,
      "lint.config.json": JSON.stringify({
        rules: {
          eqeqeq: "error",
          "no-var": "error",
          "prefer-const": "error",
        },
      }),
    },
    {
      compilerOptions: {
        plugins: [{ transform: "@ttsc/lint" }],
      },
    },
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
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    fs.readFileSync(path.join(root, "src", "main.ts"), "utf8"),
    'const legacy = 1;\nconst stable = legacy;\nif (typeof stable === "number") { JSON.stringify(stable); }\n',
  );
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
}
