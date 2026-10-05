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
 *    their order in `passthrough`. Assert the post-entry tokens are the program
 *    `tail`, never forwarded to tsgo.
 * 3. Parse two genuinely unknown spaced option pairs before the entry with the
 *    predicate and assert the pairs stay in `passthrough` and only the entry is
 *    positional.
 * 4. Parse `--notACompilerOption es2020 entry.ts` without a predicate and assert
 *    the unknown option's value becomes the positional sentinel and the entry
 *    falls into the tail (the behavior the predicate exists to avoid).
 *
 * @evidence contracts/testing.md#behavioral-verification Calls parseFlags in ttsx mode on `--target es2020 --module commonjs entry.ts generate --input X` and asserts positional, passthrough and tail, then calls it on two unknown spaced option pairs with the predicate and on an unknown-option argv without a predicate, asserting positional, passthrough and tail each time.
 * @evidence contracts/testing.md#independent-expectations The expected positional, passthrough and tail arrays are authored literals from the documented argv ownership (launcher options, then the entry, then the program's own argv), not derived from the parser.
 * @evidence contracts/testing.md#distinguishing-cases The first case keeps both spaced pairs in passthrough and the entry as the only positional; because the compiler table also gives target and module their arity, it does not by itself prove the predicate's contribution. The unknown-pair case with the predicate does: neither pair is known to the schema or the compiler table, so only the predicate keeps their values out of the positional slot. The last case records, without a predicate, the unknown option's value taking the sentinel slot and the real entry falling into the tail.
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

    // The predicate's contribution: options neither the schema nor the compiler's
    // table knows keep their spaced values in order, and only the real entry
    // opens the program tail.
    const unknownPairs = parseFlags({
      argv: [
        "--futureAlpha",
        "left",
        "--futureBeta",
        "right",
        "entry.ts",
        "generate",
      ],
      errorPrefix: "ttsx:",
      forwardAfterFirstPositional: true,
      honorDoubleDashSeparator: true,
      isPositional: isEntry,
      subcommand: "ttsx",
    });
    assert.deepEqual(unknownPairs.positional, ["entry.ts"]);
    assert.deepEqual(unknownPairs.passthrough, [
      "--futureAlpha",
      "left",
      "--futureBeta",
      "right",
    ]);
    assert.deepEqual(unknownPairs.tail, ["generate"]);

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
