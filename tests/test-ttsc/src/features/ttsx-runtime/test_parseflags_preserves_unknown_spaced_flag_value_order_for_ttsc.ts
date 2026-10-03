import assert from "node:assert/strict";

import { parseFlags } from "../../../../../packages/ttsc/src/flags/parseFlags";

const isTsInput = (token: string): boolean =>
  [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));

/**
 * Verifies the launcher parser keeps every unknown `--flag value` pair in its
 * original order at the tsgo boundary for the ttsc build subcommand.
 *
 * The bug this pins split an unknown flag into `passthrough` and its bare value
 * into `positional`, so `parseBuildArgs` rebuilt the stream as
 * `[...passthrough, ...values]` — every flag ahead of every value. With
 * `isPositional`, a bare value that is not a TypeScript input stays in
 * `passthrough` in place, so two spaced pairs keep their adjacency and only the
 * real `.ts` input is a positional.
 *
 * 1. Parse `--target es2020 --module commonjs a.ts` with the TS-extension
 *    predicate.
 * 2. Assert `passthrough` is exactly the two pairs interleaved in order.
 * 3. Assert the negative twins: the `.ts` input is the only positional, an inline
 *    `--flag=value` stays one token, and an unknown boolean is not given a
 *    value.
 *
 * @evidence contracts/testing.md#behavioral-verification parseFlags preserves spaced compiler and genuinely unknown option pairs in order, separating only actual TypeScript inputs.
 * @evidence contracts/testing.md#independent-expectations Literal ordered argv arrays fix adjacency independently of the compiler option table or parser reconstruction.
 * @evidence contracts/testing.md#distinguishing-cases Known table values, two genuinely unknown spaced pairs, a compiler inline value and an unknown boolean cover different arity paths; the no-predicate twin exposes value misclassification.
 * @evidence contracts/testing.md#execution-ownership The exported source case directly invokes the authored parser for build argv; it tests partitioning rather than a native compiler recognizing future options.
 */
export const test_parseflags_preserves_unknown_spaced_flag_value_order_for_ttsc =
  () => {
    const result = parseFlags({
      argv: ["--target", "es2020", "--module", "commonjs", "a.ts"],
      errorPrefix: "ttsc:",
      isPositional: isTsInput,
      subcommand: "build",
    });
    assert.deepEqual(result.passthrough, [
      "--target",
      "es2020",
      "--module",
      "commonjs",
    ]);
    assert.deepEqual(result.positional, ["a.ts"]);

    // The compiler's own option table decides a documented option's arity, so
    // `--target` and `--module` keep their values without the predicate too
    // (samchon/ttsc#1569).
    const tabled = parseFlags({
      argv: ["--target", "es2020", "--module", "commonjs", "a.ts"],
      errorPrefix: "ttsc:",
      subcommand: "build",
    });
    assert.deepEqual(tabled.positional, ["a.ts"]);

    // Negative twin: after an option neither the schema nor that table knows,
    // without the predicate the bare value falls into `positional` (the
    // historical behaviour these callers must not use).
    const naive = parseFlags({
      argv: ["--notACompilerOption", "es2020", "a.ts"],
      errorPrefix: "ttsc:",
      subcommand: "build",
    });
    assert.deepEqual(naive.positional, ["es2020", "a.ts"]);

    const unknownPairs = parseFlags({
      argv: ["--futureAlpha", "left", "--futureBeta", "right", "entry.ts"],
      errorPrefix: "ttsc:",
      isPositional: isTsInput,
      subcommand: "build",
    });
    assert.deepEqual(unknownPairs.passthrough, ["--futureAlpha", "left", "--futureBeta", "right"]);
    assert.deepEqual(unknownPairs.positional, ["entry.ts"]);

    // Inline `--flag=value` stays a single token; an unknown boolean is not
    // given the following input file as a value.
    const mixed = parseFlags({
      argv: ["--target=es2020", "--experimentalUnknownBool", "b.ts"],
      errorPrefix: "ttsc:",
      isPositional: isTsInput,
      subcommand: "build",
    });
    assert.deepEqual(mixed.passthrough, [
      "--target=es2020",
      "--experimentalUnknownBool",
    ]);
    assert.deepEqual(mixed.positional, ["b.ts"]);
  };
