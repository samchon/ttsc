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
 * @evidence contracts/testing.md#behavioral-verification Actual ttsc format with --singleThreaded writes semicolons and converts the separate single-quoted export to exact double-quoted text without JavaScript emission.
 * @evidence contracts/testing.md#independent-expectations Explicit semi true and singleQuote false independently require both literal output files; zero status proves command acceptance, not actual worker count.
 * @evidence contracts/testing.md#distinguishing-cases Owns format dispatch distinct from fix, two formatting decisions and singleThreaded CLI acceptance, with noEmit true preserving the output-negative control.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-ttsc export owns both original formatter scenarios in one real native format invocation in the Linux batch.
 * @evidence contracts/e2e.md#necessary-boundary The installed launcher must route format and accept the threading option while retaining native file writes; portable formatting or argv units cannot prove this command connection.
 * @evidence contracts/e2e.md#shared-execution Both formatter inputs share one consumer project load and one native invocation, as well as the batch lint binary; neither scenario rebuilds a producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The isolated project contains two independent input files and explicit formatting options; file edits are confined to this project and immutable native artifacts alone are shared.
 * @evidence contracts/e2e.md#preserved-coverage The original exact semicolon file, exact single-to-double-quote file, success status and absent JavaScript output execute here. The old threading case did not observe worker count and this case does not claim to; test_native_check_arguments_gate_threading_without_name_shortcuts separately owns actual descriptor-to-argv capability/command controls without another native build.
 */
export function test_plugin_corpus_ttsc_lint_format_subcommand_rewrites_source(): void {
  const root = commonJsProject(
    {
      "src/main.ts": `const value = 1\nJSON.stringify(value)\n`,
      "src/single.ts": `export const value = 'single';\n`,
      "lint.config.json": JSON.stringify({
        format: { semi: true, singleQuote: false },
      }),
    },
    {
      compilerOptions: {
        noEmit: true,
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
