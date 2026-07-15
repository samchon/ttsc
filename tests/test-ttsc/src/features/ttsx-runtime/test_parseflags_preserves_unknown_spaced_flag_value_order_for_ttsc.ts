import assert from "node:assert/strict";

import { parseFlags } from "../../../../../packages/ttsc/lib/flags/parser.js";

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

    // Negative twin: without the predicate the bare values fall into
    // `positional` (the historical behaviour these callers must not use).
    const naive = parseFlags({
      argv: ["--target", "es2020", "--module", "commonjs", "a.ts"],
      errorPrefix: "ttsc:",
      subcommand: "build",
    });
    assert.deepEqual(naive.positional, ["es2020", "commonjs", "a.ts"]);

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
