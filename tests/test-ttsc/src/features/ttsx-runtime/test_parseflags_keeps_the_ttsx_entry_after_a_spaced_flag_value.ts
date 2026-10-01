import assert from "node:assert/strict";

import { parseFlags } from "../../../../../packages/ttsc/src/flags/parseFlags";

const isEntry = (token: string): boolean =>
  [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));

/**
 * Verifies the launcher parser identifies the ttsx entry after a spaced flag
 * value and keeps the forwarded pairs and the program tail separated.
 *
 * With `forwardAfterFirstPositional`, a pre-entry flag value like the `es2020`
 * of `--target es2020` used to become the first positional sentinel, flipping
 * the parser into tail mode so the real entry was pushed into `tail` and ttsx
 * failed with "entry file is required". Classifying the value with
 * `isPositional` keeps it in `passthrough` in order, so the first true
 * positional is the entry and only tokens after it become the program tail.
 * (`--target` and `--module` now also keep their values through the compiler's
 * option table, so the first case cannot tell the table from the predicate.)
 *
 * 1. Parse `--target es2020 --module commonjs entry.ts generate --input X` with
 *    the entry predicate and `forwardAfterFirstPositional`.
 * 2. Assert the entry is the only positional and the two forwarded pairs keep
 *    their order in `passthrough`.
 * 3. Assert the post-entry tokens are the program `tail`, never forwarded to tsgo.
 * 4. Parse `--notACompilerOption es2020 entry.ts` without a predicate and assert
 *    the unknown option's value becomes the positional sentinel and the entry
 *    falls into the tail (the behavior the predicate exists to avoid).
 *
 * @evidence contracts/testing.md#behavioral-verification Calls parseFlags in ttsx mode on `--target es2020 --module commonjs entry.ts generate --input X` and asserts positional, passthrough and tail, then calls it on an unknown-option argv without a predicate and asserts positional and tail.
 * @evidence contracts/testing.md#independent-expectations The expected positional, passthrough and tail arrays are authored literals from the documented argv ownership (launcher options, then the entry, then the program's own argv), not derived from the parser.
 * @evidence contracts/testing.md#distinguishing-cases The first case keeps both spaced pairs in passthrough and the entry as the only positional; because the compiler table also gives target and module their arity, it does not prove the predicate's contribution. The second case records, without a predicate, the unknown option's value taking the sentinel slot, but the same argv is not re-parsed with the predicate here, so the predicate fix itself is exercised only by the sibling parseFlags tests.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttsx-runtime; it calls parseFlags directly on in-memory argv arrays with an extension predicate, with no compiler, process or program execution.
 */
export const test_parseflags_keeps_the_ttsx_entry_after_a_spaced_flag_value =
  () => {
    const result = parseFlags({
      argv: [
        "--target",
        "es2020",
        "--module",
        "commonjs",
        "entry.ts",
        "generate",
        "--input",
        "X",
      ],
      errorPrefix: "ttsx:",
      forwardAfterFirstPositional: true,
      honorDoubleDashSeparator: true,
      isPositional: isEntry,
      subcommand: "ttsx",
    });
    assert.deepEqual(result.positional, ["entry.ts"]);
    assert.deepEqual(result.passthrough, [
      "--target",
      "es2020",
      "--module",
      "commonjs",
    ]);
    assert.deepEqual(result.tail, ["generate", "--input", "X"]);

    // Negative twin: after an option neither the schema nor the compiler's own
    // table knows, without the predicate, the value becomes the sentinel and
    // the real entry is lost to the tail — the failure the predicate prevents.
    // `--target` itself no longer needs the predicate: the compiler's table
    // says it takes a value (samchon/ttsc#1569).
    const naive = parseFlags({
      argv: ["--notACompilerOption", "es2020", "entry.ts"],
      errorPrefix: "ttsx:",
      forwardAfterFirstPositional: true,
      honorDoubleDashSeparator: true,
      subcommand: "ttsx",
    });
    assert.deepEqual(naive.positional, ["es2020"]);
    assert.deepEqual(naive.tail, ["entry.ts"]);
  };
