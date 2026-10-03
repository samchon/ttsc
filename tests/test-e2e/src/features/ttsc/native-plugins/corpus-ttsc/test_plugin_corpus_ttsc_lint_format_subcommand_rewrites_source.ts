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
 * Verifies plugin corpus: @ttsc/lint format subcommand rewrites source files.
 *
 * The launcher must route the positional `format` subcommand to check-stage
 * plugins with the `format` binary command — distinct from `fix`. A regression
 * in the `case "format":` switch arm surfaces immediately through this
 * scenario.
 *
 * 1. Materialize a project with one missing-semi violation and a
 *    `lint.config.json` whose `format` block enables semicolons.
 * 2. Run one `ttsc format --singleThreaded` with explicit semicolon and double-quote options through the real launcher and shared source-plugin cache.
 * 3. Assert the source file gains the semicolon and no JavaScript is emitted.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsc format with --singleThreaded writes semicolons and converts the separate single-quoted export to exact double-quoted text while dist/main.js remains absent; other possible output paths are not enumerated.
 * @evidence contracts/testing.md#independent-expectations Explicit semi true and singleQuote false independently require both literal output files; zero status proves command acceptance, not actual worker count.
 * @evidence contracts/testing.md#distinguishing-cases Owns format dispatch distinct from fix, two formatting decisions and singleThreaded CLI acceptance, with noEmit true preserving the output-negative control.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named corpus-ttsc export in the generic E2E population. Both original file observations belong to one public format command with the explicit workspace lint junction, not a packed installation or Linux-only selection claim.
 * @evidence contracts/e2e.md#necessary-boundary The public launcher must route format and accept the threading option while retaining native file writes; portable formatting or argv units cannot prove this command connection.
 * @evidence contracts/e2e.md#shared-execution Both input files share one public format invocation and unchanged workspace producer with the explicit suite cache. The body does not count Program constructions or child invocations, prove a hit/no rebuild or establish minimum preparation cost. The original selected Go path or PATH fallback remains distinct from executable-byte equality.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked consumer owns both input files/options and initially absent dist/main.js; each input differs from its exact expected replacement. Error, signal and status are checked before consuming edits; synchronous return does not certify arbitrary descendants or loaded-image equality. Suite cache/workspace producer are not consumer cleanup targets.
 * @evidence contracts/e2e.md#preserved-coverage Original exact semicolon file, exact double-quote file, success and absent dist/main.js assertions remain. --singleThreaded acceptance is not actual worker count. The named native-check argument unit retains its separate capability/command selection and survival obligations, without this output certifying its execution or donor deletion.
 */
export function test_plugin_corpus_ttsc_lint_format_subcommand_rewrites_source(): void {
  const root = commonJsProject(
    FixtureFiles.read("ttsc/plugin_corpus_ttsc_lint_format_subcommand_rewrites_source/inputs-1"),
    {
      compilerOptions: {
        noEmit: true,
        plugins: [{ transform: "@ttsc/lint" }],
      },
    },
  );
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  assert.notEqual(
    fs.readFileSync(path.join(root, "src", "main.ts"), "utf8"),
    "const value = 1;\nJSON.stringify(value);\n",
  );
  assert.notEqual(
    fs.readFileSync(path.join(root, "src", "single.ts"), "utf8"),
    `export const value = "single";\n`,
  );
  const linkDir = path.join(root, "node_modules", "@ttsc");
  fs.mkdirSync(linkDir, { recursive: true });
  fs.symlinkSync(
    path.join(workspaceRoot, "packages", "lint"),
    path.join(linkDir, "lint"),
    "junction",
  );

  const goBinary = path.join(os.homedir(), "go-sdk", "go", "bin", "go");
  const result = spawn(ttscBin, [
    "format", "--cwd", root, "-p", path.join(root, "tsconfig.json"), "--singleThreaded",
  ], {
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
    "const value = 1;\nJSON.stringify(value);\n",
  );
  assert.equal(
    fs.readFileSync(path.join(root, "src", "single.ts"), "utf8"),
    `export const value = "single";\n`,
  );
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
}
