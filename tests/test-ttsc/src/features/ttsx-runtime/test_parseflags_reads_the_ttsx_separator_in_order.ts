import assert from "node:assert/strict";

import { parseFlags } from "../../../../../packages/ttsc/src/flags/parseFlags";

const isEntry = (token: string): boolean =>
  [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));

/**
 * Verifies the launcher parser reads `--` in order in ttsx's mode, and still
 * splits on the first `--` in ttsc's.
 *
 * Pins samchon/ttsc#1401 at the parser. With `forwardAfterFirstPositional`,
 * everything after the entry is the program's argv, so a `--` there belongs to
 * the program, except the one directly after the entry, which stays the
 * documented optional separator. A `--` before the entry still ends the
 * launcher's options. Without that option the parser keeps the split on the
 * first `--` that ttsc relies on, so ttsc's forwarding is untouched.
 *
 * 1. Parse ttsx argv shapes with a `--` right after the entry, a later one, two in
 *    a row, and none but a `--help` after the entry.
 * 2. Assert each program tail, and that a post-entry `--help` is tail, not a
 *    launcher value.
 * 3. Parse a ttsc argv with `--` and assert the split-first behaviour.
 *
 * @evidence contracts/testing.md#behavioral-verification parseFlags consumes the optional separator immediately after the entry but retains later program separators and preserves ttsc split-first behavior.
 * @evidence contracts/testing.md#independent-expectations Literal tail and passthrough arrays fix each separator position and the help-token ownership independently.
 * @evidence contracts/testing.md#distinguishing-cases Immediate, later, doubled and pre-entry separators plus post-entry help distinguish launcher boundaries from program argv; the ttsc control covers the other parser mode.
 * @evidence contracts/testing.md#execution-ownership The named source unit directly runs both parser modes with authored argv, without spawning ttsx or the user program.
 */
export const test_parseflags_reads_the_ttsx_separator_in_order = () => {
  const ttsx = (argv: string[]) =>
    parseFlags({
      argv,
      errorPrefix: "ttsx:",
      forwardAfterFirstPositional: true,
      honorDoubleDashSeparator: true,
      isPositional: isEntry,
      subcommand: "ttsx",
    });

  assert.deepEqual(ttsx(["entry.ts", "--", "--port", "3000"]).tail, [
    "--port",
    "3000",
  ]);
  assert.deepEqual(ttsx(["entry.ts", "a", "--", "b"]).tail, ["a", "--", "b"]);
  assert.deepEqual(ttsx(["entry.ts", "--", "--", "x"]).tail, ["--", "x"]);

  const help = ttsx(["--strict", "entry.ts", "--help"]);
  assert.deepEqual(help.positional, ["entry.ts"]);
  assert.deepEqual(help.tail, ["--help"]);
  assert.equal(help.values.has("--help"), false);
  assert.equal(help.passthrough.includes("--help"), false);

  const before = ttsx(["--strict", "--", "entry.ts"]);
  assert.deepEqual(before.positional, []);
  assert.deepEqual(before.passthrough, ["--strict", "entry.ts"]);

  // ttsc keeps splitting on the first `--`, wherever it is.
  const ttsc = parseFlags({
    argv: ["--strict", "--", "--noEmit"],
    errorPrefix: "ttsc:",
    honorDoubleDashSeparator: true,
    subcommand: "ttsc",
  });
  assert.deepEqual(ttsc.passthrough, ["--strict", "--noEmit"]);
};
