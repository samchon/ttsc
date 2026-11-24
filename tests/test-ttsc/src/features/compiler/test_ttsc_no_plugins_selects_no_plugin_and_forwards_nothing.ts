import assert from "node:assert/strict";

import { parseTtscBuildArgs } from "../../../../../packages/ttsc/src/launcher/internal/parseTtscBuildArgs";
import { prepareTtscBuildMode } from "../../../../../packages/ttsc/src/launcher/internal/prepareTtscBuildMode";

/**
 * Verifies `ttsc --no-plugins` selects no plugin entry and never reaches tsgo.
 *
 * The build pipeline treats `plugins: false` as "this project has no plugin
 * entry", the value ttsx already passes. Before #1867 the ttsc parser did not
 * own the flag, so it was forwarded to tsgo as an unknown option while plugin
 * discovery still ran.
 *
 * 1. Parse `--no-plugins` for the build, check and watch commands and require
 *    `plugins: false` with an empty passthrough.
 * 2. Parse the same commands without it and require no plugin selection.
 * 3. Keep a forwarded compiler flag beside it in order.
 *
 * @evidence contracts/testing.md#behavioral-verification parseTtscBuildArgs and prepareTtscBuildMode run on real argv; the assertions catch a parser that forwards the flag to tsgo or leaves plugin discovery selected, and allow any option object whose plugins field is false.
 * @evidence contracts/testing.md#independent-expectations Literal false/undefined plugin selections and literal passthrough arrays come from the flag's documented meaning and the existing `plugins: false` contract of TtscCommonOptions, not from parser output.
 * @evidence contracts/testing.md#distinguishing-cases Owns presence versus absence of the flag on build, check and watch, and its coexistence with a forwarded compiler flag; test_ttsx_no_plugins_skips_plugin_loading owns the ttsx lane, and the plugin loader's own tests own what `plugins: false` skips at runtime.
 * @evidence contracts/testing.md#execution-ownership A unit test calling the launcher parser and mode adapter in process; it starts no CLI, compiler or plugin host.
 */
export function test_ttsc_no_plugins_selects_no_plugin_and_forwards_nothing(): void {
  for (const [argv, mode] of [
    [["--no-plugins"], "build"],
    [["--no-plugins"], "check"],
    [["--watch", "--no-plugins", "--noEmit"], "build"],
  ] as const) {
    const options = prepareTtscBuildMode(parseTtscBuildArgs(argv), mode);
    assert.equal(options.plugins, false, argv.join(" "));
    assert.deepEqual(options.passthrough, [], argv.join(" "));
  }
  for (const mode of ["build", "check"] as const)
    assert.equal(
      prepareTtscBuildMode(parseTtscBuildArgs([]), mode).plugins,
      undefined,
    );
  const forwarded = parseTtscBuildArgs(["--strict", "--no-plugins"]);
  assert.equal(forwarded.plugins, false);
  assert.deepEqual(forwarded.passthrough, ["--strict"]);
}
