import assert from "node:assert/strict";

import { parseFlags } from "../../../../../packages/ttsc/src/flags/parseFlags";

/**
 * Verifies the launcher parser takes a compiler option's arity from the
 * compiler's own option table, so the entry is the first bare token that is no
 * option's value, whatever its extension.
 *
 * Ttsx used to guess from the entry's extension which bare token was a flag
 * value: only a TypeScript-extensioned token could be the entry, so a
 * JavaScript entry was read as a value and everything after it as compiler
 * flags (samchon/ttsc#1569). `COMPILER_OPTIONS`, generated from the pinned
 * native option declarations, now owns option kind, list and configuration
 * boundaries.
 *
 * 1. Parse `--target es2020 --strict --noEmitOnError false script.js a --help` the
 *    way ttsx does, with no positional predicate.
 * 2. Assert `es2020` and the boolean literal went with their options, `script.js`
 *    is the entry, and the rest is the program's tail.
 * 3. Assert an `@file` response file goes to the compiler, not to the entry.
 * 4. Negative twin: after an option the table does not know, the next bare token
 *    is the entry, since nothing says the option takes a value.
 *
 * @evidence contracts/testing.md#behavioral-verification parseFlags uses compiler option arity to retain target and explicit boolean values while selecting a JavaScript entry and its program tail.
 * @evidence contracts/testing.md#independent-expectations Literal arrays specify target, strict and noEmitOnError forwarding plus the entry/tail split without reading the production arity table for expectations.
 * @evidence contracts/testing.md#distinguishing-cases A JavaScript entry, response-file token and unrecognized option distinguish table-owned values from an extension guess or indiscriminate value consumption.
 * @evidence contracts/testing.md#execution-ownership The actual parser runs directly in one source unit; response-file forwarding is observed as tokens, without opening the response file or launching a compiler.
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

    // A response file is the compiler's argument, read where it stands, so it is
    // no entry either.
    const response = parse(["@args.txt", "--target", "es2020", "script.js"]);
    assert.deepEqual(response.positional, ["script.js"]);
    assert.deepEqual(response.passthrough, ["@args.txt", "--target", "es2020"]);

    const unknown = parse(["--notACompilerOption", "script.js", "a"]);
    assert.deepEqual(unknown.positional, ["script.js"]);
    assert.deepEqual(unknown.passthrough, ["--notACompilerOption"]);
    assert.deepEqual(unknown.tail, ["a"]);
  };
