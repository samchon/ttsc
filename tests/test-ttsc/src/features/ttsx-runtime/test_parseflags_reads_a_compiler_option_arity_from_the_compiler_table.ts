import assert from "node:assert/strict";

import { parseFlags } from "../../../../../packages/ttsc/lib/flags/parseFlags.js";

/**
 * Verifies the launcher parser takes a compiler option's arity from the
 * compiler's own option table, so the entry is the first bare token that is
 * no option's value, whatever its extension.
 *
 * ttsx used to guess from the entry's extension which bare token was a flag
 * value: only a TypeScript-extensioned token could be the entry, so a
 * JavaScript entry was read as a value and everything after it as compiler
 * flags (samchon/ttsc#1569). `COMPILER_OPTION_KINDS`, generated from the
 * pinned `tsc --help --all`, now says which options take a value.
 *
 * 1. Parse `--target es2020 --strict --noEmitOnError false script.js a --help`
 *    the way ttsx does, with no positional predicate.
 * 2. Assert `es2020` and the boolean literal went with their options,
 *    `script.js` is the entry, and the rest is the program's tail.
 * 3. Negative twin: after an option the table does not know, the next bare
 *    token is the entry, since nothing says the option takes a value.
 */
export const test_parseflags_reads_a_compiler_option_arity_from_the_compiler_table =
  () => {
    const parse = (argv: string[]) =>
      parseFlags({
        argv,
        errorPrefix: "ttsx:",
        forwardAfterFirstPositional: true,
        honorDoubleDashSeparator: true,
        subcommand: "ttsx",
      });

    const known = parse([
      "--target",
      "es2020",
      "--strict",
      "--noEmitOnError",
      "false",
      "script.js",
      "a",
      "--help",
    ]);
    assert.deepEqual(known.positional, ["script.js"]);
    assert.deepEqual(known.passthrough, [
      "--target",
      "es2020",
      "--strict",
      "--noEmitOnError",
      "false",
    ]);
    assert.deepEqual(known.tail, ["a", "--help"]);

    const unknown = parse(["--notACompilerOption", "script.js", "a"]);
    assert.deepEqual(unknown.positional, ["script.js"]);
    assert.deepEqual(unknown.passthrough, ["--notACompilerOption"]);
    assert.deepEqual(unknown.tail, ["a"]);
  };
