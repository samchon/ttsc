import assert from "node:assert/strict";

import { parseTtsxCLI } from "../../../../../packages/ttsc/src/launcher/internal/parseTtsxCLI";

/**
 * Verifies launcher parsing owns preloads, program tails and early mode errors.
 *
 * Unlike tests of parseFlags alone, this calls the exact launcher projection
 * that formerly rescanned TypeScript preload tokens and dropped them. Real
 * preload execution, argv transport and error rendering remain in CLI hosts.
 *
 * 1. Parse every original require spelling and program-tail scenario.
 * 2. Compare exact ordered preloads, compiler flags and program argv.
 * 3. Exercise terminal precedence and malformed/unsupported pre-entry requests.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher parser returns ordered preload and tail arrays and throws its own mode/value errors; assertions detect the historical projection bug beyond the shared schema parser.
 * @evidence contracts/testing.md#independent-expectations Node-style arguments after an entry belong to that program, one immediate optional separator is consumed, and each pre-entry require value retains argv order; unsupported one-shot watch/build and missing values independently require explicit errors.
 * @evidence contracts/testing.md#distinguishing-cases Six spaced/inline/mixed preload forms, all seven original terminal/separator tails and the original side-effect --mode/probe tail, non-separated generator flags, post-entry watch/build/require, pre-entry refusals, terminal recovery from malformed flags and typed launcher values, original spaced target/module and bare pretty compiler flags, and both uppercase project spellings and the original long --project configs/app.json request cover both ownership directions.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttsx-runtime; it calls only the exported parseTtsxCLI (its terminal-request and watch helpers are reached through it) on in-memory argv arrays, with no project, compiler, preload execution or process.
 */
export function test_parse_ttsx_cli_preserves_preload_order_program_arguments_and_early_rejections() {
  const record = (argv: string[]) => {
    const result = parseTtsxCLI(argv);
    assert.equal(typeof result, "object");
    if (typeof result === "string") throw new Error("expected launcher options");
    return result;
  };
  for (const [flags, expected] of [
    [["-r", "./a.cjs", "-r", "./b.cjs"], ["./a.cjs", "./b.cjs"]],
    [["-r", "./a.ts", "-r", "./b.cjs"], ["./a.ts", "./b.cjs"]],
    [["--require=./a.ts"], ["./a.ts"]],
    [["--require=./a.ts", "-r", "./b.cjs"], ["./a.ts", "./b.cjs"]],
    [["-r=./a.cjs"], ["./a.cjs"]],
    [["-r", "./c.tsx", "-r", "./b.cjs"], ["./c.tsx", "./b.cjs"]],
  ]) {
    const result = record([...flags!, "src/main.ts"]);
    assert.deepEqual(result.preload, expected);
    assert.equal(result.entry, "src/main.ts");
    assert.deepEqual(result.tsgoFlags, []);
    assert.deepEqual(result.passthrough, []);
  }
  for (const [tail, expected] of [
    [["--help"], ["--help"]], [["-h"], ["-h"]],
    [["--version"], ["--version"]], [["-v"], ["-v"]],
    [["a", "--", "b"], ["a", "--", "b"]],
    [["--", "--port", "3000"], ["--port", "3000"]],
    [["--", "--", "x"], ["--", "x"]],
    [["--", "--mode", "probe"], ["--mode", "probe"]],
    [["generate", "--input", "X", "--output", "Y"], ["generate", "--input", "X", "--output", "Y"]],
    [["--watch"], ["--watch"]], [["--build"], ["--build"]],
    [["-r", "./a.cjs"], ["-r", "./a.cjs"]],
  ]) {
    const result = record(["src/main.ts", ...tail!]);
    assert.deepEqual(result.passthrough, expected);
    assert.deepEqual(result.preload, []);
    assert.deepEqual(result.tsgoFlags, []);
  }
  const spacedCompiler = record(["--target", "es2020", "--module", "commonjs", "src/main.ts", "alpha", "beta"]);
  assert.equal(spacedCompiler.entry, "src/main.ts");
  assert.deepEqual(spacedCompiler.tsgoFlags, ["--target", "es2020", "--module", "commonjs"]);
  assert.deepEqual(spacedCompiler.passthrough, ["alpha", "beta"]);
  const booleanCompiler = record(["--pretty", "src/main.ts"]);
  assert.equal(booleanCompiler.entry, "src/main.ts");
  assert.deepEqual(booleanCompiler.tsgoFlags, ["--pretty"]);
  assert.deepEqual(booleanCompiler.passthrough, []);
  for (const projectFlags of [["-P", "alt/tsconfig.json"], ["-P=alt/tsconfig.json"]]) {
    const projected = record([...projectFlags, "src/main.ts"]);
    assert.equal(projected.project, "alt/tsconfig.json");
    assert.equal(projected.entry, "src/main.ts");
    assert.deepEqual(projected.tsgoFlags, []);
    assert.deepEqual(projected.passthrough, []);
  }
  const originalLongProject = record(["--project", "configs/app.json", "src/main.ts"]);
  assert.equal(originalLongProject.project, "configs/app.json");
  assert.equal(originalLongProject.entry, "src/main.ts");
  assert.deepEqual(originalLongProject.tsgoFlags, []);
  assert.deepEqual(originalLongProject.passthrough, []);
  for (const flag of ["--watch", "-w"]) assert.throws(() => parseTtsxCLI([flag, "src/main.ts"]), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /--watch is not supported/);
    assert.match(error.message, /ttsc --watch --noEmit/);
    assert.match(error.message, /node --watch --require ttsc\/register/);
    return true;
  });
  for (const args of [["--build"], ["-b"], ["--build", "false"]]) assert.throws(() => parseTtsxCLI([...args, "src/main.ts"]), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /ttsx: --build \(solution mode\) is not supported/);
    assert.doesNotMatch(error.message, /TS6369/);
    return true;
  });
  for (const flag of ["-r", "--require"]) assert.throws(() => parseTtsxCLI([flag]), /requires a value/);
  assert.throws(() => parseTtsxCLI([]), /entry file is required/);
  assert.equal(parseTtsxCLI(["--help"]), "help");
  assert.equal(parseTtsxCLI(["--version", "src/main.ts"]), "version");
  assert.equal(parseTtsxCLI(["--HELP", "-r"]), "help");
  assert.equal(parseTtsxCLI(["-Version", "-r"]), "version");
  const options = record(["--cwd", "project", "--cache-dir", "cache", "--checkers", "2", "--no-plugins", "--singleThreaded", "-P", "custom.json", "--target", "es2022", "src/main.ts"]);
  assert.equal(options.cwd, "project"); assert.equal(options.cacheDir, "cache");
  assert.equal(options.checkers, 2); assert.equal(options.noPlugins, true);
  assert.equal(options.singleThreaded, true); assert.equal(options.project, "custom.json");
  assert.deepEqual(options.tsgoFlags, ["--target", "es2022"]);
}
