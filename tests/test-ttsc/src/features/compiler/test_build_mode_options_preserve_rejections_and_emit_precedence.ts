import assert from "node:assert/strict";

import { parseTtscBuildArgs } from "../../../../../packages/ttsc/src/launcher/internal/parseTtscBuildArgs";
import { prepareTtscBuildMode } from "../../../../../packages/ttsc/src/launcher/internal/prepareTtscBuildMode";

/**
 * Verifies the launcher's actual command decisions without compiling a project.
 *
 * Each original fix/format rejection now calls the same parser and mode adapter
 * as the CLI. Conflicting inputs pin validation order, while valid commands
 * distinguish a real refusal from an implementation that rejects everything.
 *
 * 1. For fix and format modes, parse conflicting emit, watch and single-file
 *    arguments and require the exact rejection of each, in the validation order
 *    its input pins.
 * 2. Accept an explicitly disabled emit and require the mode flags it sets, then
 *    resolve emit for build, check and watch commands.
 * 3. Resolve emit from the emit and noEmit boolean spellings and require the
 *    literal result of each.
 * 4. Parse single-file extensions, forwarded flags and the quiet and verbose
 *    switches.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTtscBuildArgs and prepareTtscBuildMode are executed for fix and format with five refusal argv lists each (--emit, --watch, a single file, and the two combined orderings), then for --emit=false acceptance, build/check/watch emit resolution, the four emit/noEmit spellings, four source extensions, forwarded flag values and the quiet/verbose switches.
 * @evidence contracts/testing.md#independent-expectations Literal complete messages, booleans and ordered argument arrays define the oracle; no CLI subprocess or duplicate mode validator generates expectations.
 * @evidence contracts/testing.md#distinguishing-cases Owns emit/watch/single-file rejection for both mutation commands, error precedence when combined, accepted false emit, ordinary build/check and watch check emit ownership, all source extensions and unknown flag/value adjacency.
 * @evidence contracts/testing.md#execution-ownership A unit test that calls parseTtscBuildArgs and prepareTtscBuildMode in process with fresh option objects for each argv; it spawns no CLI and compiles no project, so exit codes and stderr transport are not exercised.
 */
export function test_build_mode_options_preserve_rejections_and_emit_precedence(): void {
  for (const mode of ["fix", "format"] as const) {
    const cases = [
      { argv: ["--emit"], message: `ttsc: ${mode} and --emit are mutually exclusive` },
      { argv: ["--watch"], message: `ttsc: ${mode} does not support watch mode; use ttsc --noEmit --watch for incremental checks` },
      { argv: ["src/main.ts"], message: `ttsc: ${mode} requires a project, not single-file mode` },
      { argv: ["--emit", "--watch", "src/main.ts"], message: `ttsc: ${mode} and --emit are mutually exclusive` },
      { argv: ["--watch", "src/main.ts"], message: `ttsc: ${mode} does not support watch mode; use ttsc --noEmit --watch for incremental checks` },
    ];
    for (const testCase of cases) {
      assert.throws(() => prepareTtscBuildMode(parseTtscBuildArgs(testCase.argv), mode), {
        message: testCase.message,
      });
    }
    const accepted = prepareTtscBuildMode(parseTtscBuildArgs(["--emit=false"]), mode);
    assert.equal(accepted.emit, false);
    assert.equal(accepted.fix, mode === "fix");
    assert.equal(accepted.format, mode === "format");
  }
  assert.equal(prepareTtscBuildMode(parseTtscBuildArgs([]), "build").emit, undefined);
  assert.equal(prepareTtscBuildMode(parseTtscBuildArgs(["--emit"]), "check").emit, false);
  const watched = prepareTtscBuildMode(parseTtscBuildArgs(["--watch", "--emit"]), "check");
  assert.equal(watched.watch, true);
  assert.equal(watched.emit, true, "watch's own check-only adapter retains ownership of emit suppression");
  for (const [argv, expected] of [
    [["--emit=false", "--noEmit=false"], false],
    [["--emit=true", "--noEmit=true"], true],
    [["--noEmit=false"], true],
    [["--noEmit=true"], false],
  ] as const) assert.equal(parseTtscBuildArgs(argv).emit, expected);
  for (const extension of ["ts", "tsx", "mts", "cts"]) {
    assert.deepEqual(parseTtscBuildArgs([`main.${extension}`]).files, [`main.${extension}`]);
  }
  const forwarded = parseTtscBuildArgs(["--target", "es2020", "--unknown", "value", "main.ts"]);
  assert.deepEqual(forwarded.passthrough, ["--target", "es2020", "--unknown", "value"]);
  assert.deepEqual(forwarded.files, ["main.ts"]);
  assert.equal(forwarded.quiet, true);
  assert.equal(parseTtscBuildArgs(["--verbose", "--quiet"]).quiet, false);
}
