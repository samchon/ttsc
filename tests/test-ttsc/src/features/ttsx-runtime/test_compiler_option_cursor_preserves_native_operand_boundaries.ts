import assert from "node:assert/strict";

import { PassthroughFlags } from "../../../../../packages/ttsc/src/compiler/internal/build/PassthroughFlags";
import { normalizeFlagToken } from "../../../../../packages/ttsc/src/flags/normalizeFlagToken";
import { parseFlags } from "../../../../../packages/ttsc/src/flags/parseFlags";
import { readCompilerOptionOccurrence } from "../../../../../packages/ttsc/src/flags/readCompilerOptionOccurrence";
import { parseTtsxCLI } from "../../../../../packages/ttsc/src/launcher/internal/parseTtsxCLI";

/**
 * Keeps native option operands out of launcher requests and preserves retained
 * option ownership when internal boolean options are removed.
 *
 * 1. Read literal scalar, list, configuration-only, null and Unicode boundaries.
 * 2. Classify actual forwarded argv and remove timing/emit booleans without
 *    rebinding remaining file or option tokens.
 * 3. Parse actual ttsx entry/tail boundaries and distinguish genuine terminal
 *    and watch requests from dash-prefixed scalar operands.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual occurrence reading, passthrough classification/removal and launcher parsing preserve native scalar operands, reset tokens and entry/tail ownership.
 * @evidence contracts/testing.md#independent-expectations Literal widths and argv arrays follow pinned native ParseCommandLine witnesses; expectations do not derive from the generated metadata or production cursor.
 * @evidence contracts/testing.md#distinguishing-cases Scalar dash operands contrast with list lookahead, config-only false/null contrasts with rejected true, empty tokens contrast with FEFF and Unicode White_Space, and removal fences distinguish both list and implicit-boolean rebinding.
 * @evidence contracts/testing.md#execution-ownership One discoverable source unit calls the maintained TypeScript operations directly; native oracle runs independently validate the literal grammar without rebuilding shared SDK/lib artifacts here.
 */
export const test_compiler_option_cursor_preserves_native_operand_boundaries = () => {
  const widths: readonly [readonly string[], 1 | 2][] = [
    [["--target", "--diagnostics"], 2],
    [["--outDir", "--noEmit"], 2],
    [["--maxNodeModuleJsDepth", "-1"], 2],
    [["--lib", "--diagnostics"], 1],
    [["--lib", "invalid"], 2],
    [["--lib", ", ,"], 1],
    [["--lib", "\uFEFF"], 1],
    [["--lib", "\u200B,"], 1],
    [["--types", ""], 1],
    [["--types", ",,"], 1],
    [["--types", ", ,"], 2],
    [["--types", "\u0085"], 1],
    [["--types", "\uFEFF"], 2],
    [["--types", "\u200B,"], 2],
    [["--paths", "--diagnostics"], 1],
    [["--paths", " "], 2],
    [["--paths", "null"], 2],
    [["--composite", "true"], 2],
    [["--composite", "false"], 2],
    [["--composite", "null"], 2],
    [["--diagnostics", "null"], 2],
    [["--diagnostics", "TRUE"], 1],
    [["--diagnostics=false", "entry.ts"], 1],
    [["--unknown", "entry.ts"], 1],
  ];
  for (const [argv, width] of widths)
    assert.equal(readCompilerOptionOccurrence(argv, 0).width, width, JSON.stringify(argv));
  for (const whitespace of [" ", "\t", "\u0085", "\u3000"]) {
    const inner = "a" + whitespace.repeat(65536) + "b";
    assert.equal(readCompilerOptionOccurrence(["--types", inner], 0).width, 2);
    assert.equal(readCompilerOptionOccurrence(["--lib", inner], 0).width, 2);
    assert.equal(readCompilerOptionOccurrence(["--types", whitespace.repeat(65536)], 0).width, 1);
  }
  assert.equal(readCompilerOptionOccurrence(["--composite", "true"], 0).booleanValue, undefined);
  assert.equal(readCompilerOptionOccurrence(["--composite", "false"], 0).booleanValue, false);
  assert.equal(normalizeFlagToken("--DİAGNOSTİCS"), "diagnostics");
  assert.equal(normalizeFlagToken("--checKers"), "checkers");
  assert.equal(normalizeFlagToken("--ſtrict"), "ſtrict");

  for (const operand of ["--diagnostics", "--extendedDiagnostics", "--all", "--init"])
    assert.equal(PassthroughFlags.hasDiagnosticsFlag({ passthrough: ["--target", operand] }), false);
  assert.equal(PassthroughFlags.forwardsTerminalTsgoFlag({ passthrough: ["--target", "--all"] }), false);
  assert.equal(PassthroughFlags.forwardsProjectFreeTerminalTsgoFlag({ passthrough: ["--target", "--İNİT"] }), false);
  assert.equal(PassthroughFlags.hasDiagnosticsFlag({ passthrough: ["--lib", "--DİAGNOSTİCS"] }), true);
  assert.equal(PassthroughFlags.hasDiagnosticsFlag({ passthrough: ["--diagnostics", "null"] }), false);
  assert.equal(PassthroughFlags.forwardsInternalShadowFlag({ passthrough: ["--outDir", "--noEmİt"] }, "--noEmit"), false);
  assert.equal(PassthroughFlags.forwardsInternalShadowFlag({ passthrough: ["--noEmİt=false"] }, "--noEmit"), true);

  const removed = ["--diagnostics", "--extendedDiagnostics", "--pretty", "--noEmit"];
  const removals: readonly [readonly string[], readonly string[]][] = [
    [["--outDir", "--noEmit", "source.ts"], ["--outDir", "--noEmit", "source.ts"]],
    [["--lib", "--diagnostics", "source.ts"], ["--lib", "", "source.ts"]],
    [["--types", "--diagnostics", "source.ts"], ["--types", "", "source.ts"]],
    [["--paths", "--diagnostics", "source.ts"], ["--paths", "", "source.ts"]],
    [["--strict", "--diagnostics", "false", "false", "entry.ts"], ["--strict", "", "false", "entry.ts"]],
    [["--diagnostics", "null", "entry.ts"], ["entry.ts"]],
    [["--DİAGNOSTİCS", "false", "entry.ts"], ["entry.ts"]],
    [["--diagnostics=false", "entry.ts"], ["--diagnostics=false", "entry.ts"]],
    [["--strict", "--diagnostics", "--pretty", "entry.ts"], ["--strict", "", "entry.ts"]],
    [["--strict", "--diagnostics", "--noImplicitAny", "true"], ["--strict", "--noImplicitAny", "true"]],
    [["--strict", "--diagnostics", "--pretty", "--noImplicitAny", "true"], ["--strict", "--noImplicitAny", "true"]],
    [["--lib", "--diagnostics"], ["--lib", ""]],
  ];
  for (const [argv, expected] of removals)
    assert.deepEqual(PassthroughFlags.withoutBooleanFlags(argv, removed), expected);

  const parse = (argv: readonly string[]) => parseFlags({
    argv, subcommand: "ttsx", errorPrefix: "ttsx:",
    forwardAfterFirstPositional: true, honorDoubleDashSeparator: true,
  });
  for (const argv of [
    ["--target", "--help", "entry.ts", "--watch"],
    ["--rootDir", "--watch", "entry.ts", "--help"],
    ["--diagnostics", "null", "entry.ts", "arg"],
    ["--composite", "false", "entry.ts", "arg"],
    ["--types", "", "entry.ts", "arg"],
    ["--types", "\uFEFF", "entry.ts", "arg"],
  ]) {
    const parsed = parse(argv);
    assert.deepEqual(parsed.positional, ["entry.ts"]);
    assert.deepEqual(parsed.passthrough, argv.slice(0, 2));
    assert.deepEqual(parsed.tail, argv.slice(3));
    const launched = parseTtsxCLI(argv);
    assert.equal(typeof launched, "object");
    if (typeof launched !== "object") throw new Error("Expected launcher options.");
    assert.equal(launched.entry, "entry.ts");
    assert.deepEqual(launched.tsgoFlags, argv.slice(0, 2));
    assert.deepEqual(launched.passthrough, argv.slice(3));
  }
  assert.deepEqual(parse(["--lib", "--diagnostics", "entry.ts"]).passthrough, ["--lib", "--diagnostics"]);
  for (const operand of [",", ", ,", "\uFEFF", "\u200B,", "\u0085,\uFEFF,\u200B"]) {
    const parsed = parse(["--lib", operand, "entry.ts", "--diagnostics"]);
    assert.deepEqual(parsed.passthrough, ["--lib"]);
    assert.deepEqual(parsed.positional, [operand]);
    assert.deepEqual(parsed.tail, ["entry.ts", "--diagnostics"]);
    const launched = parseTtsxCLI(["--lib", operand, "entry.ts", "--diagnostics"]);
    assert.equal(typeof launched, "object");
    if (typeof launched !== "object") throw new Error("Expected launcher options.");
    assert.equal(launched.entry, operand);
    assert.deepEqual(launched.tsgoFlags, ["--lib"]);
    assert.deepEqual(launched.passthrough, ["entry.ts", "--diagnostics"]);
  }
  assert.deepEqual(parse(["--types", "\u0085", "entry.ts"]).positional, ["\u0085"]);
  assert.equal(parseTtsxCLI(["--cwd", "work", "--help", "entry.ts"]), "help");
  assert.equal(parseTtsxCLI(["--version", "--help", "entry.ts"]), "version");
  assert.equal(parseTtsxCLI(["--help", "false", "entry.ts"]), "help");
  assert.equal(parseTtsxCLI(["--cwd", "--help"]), "help");
  assert.throws(() => parseTtsxCLI(["--target", "--help", "--cwd"]), /requires a value/);
  assert.throws(() => parseTtsxCLI(["--types", "--watch", "entry.ts"]), /--watch is not supported/);
};
