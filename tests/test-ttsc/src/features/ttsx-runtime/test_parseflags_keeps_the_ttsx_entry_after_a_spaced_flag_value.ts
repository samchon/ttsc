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
 *
 * 1. Parse `--target es2020 --module commonjs entry.ts generate --input X` with
 *    the entry predicate and `forwardAfterFirstPositional`.
 * 2. Assert the entry is the only positional and the two forwarded pairs keep
 *    their order in `passthrough`.
 * 3. Assert the post-entry tokens are the program `tail`, never forwarded to tsgo.
 *
 * @evidence contracts/testing.md#behavioral-verification parseFlags partitions compiler option pairs, the first TypeScript entry and the following program argv without swallowing the entry.
 * @evidence contracts/testing.md#independent-expectations Literal positional, passthrough and tail arrays specify argv ownership and exact order independently of parser output.
 * @evidence contracts/testing.md#distinguishing-cases Spaced target/module pairs retain their values, while the unknown-option no-predicate twin demonstrates the sentinel boundary the entry predicate owns.
 * @evidence contracts/testing.md#execution-ownership The named source unit calls the authored parser directly with explicit options; native compiler acceptance and program execution remain E2E boundaries.
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
