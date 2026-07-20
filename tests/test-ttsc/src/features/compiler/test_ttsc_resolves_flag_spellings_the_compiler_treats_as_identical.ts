import assert from "node:assert/strict";

import { parseFlags } from "../../../../../packages/ttsc/lib/flags/parser.js";

const isInputFile = (token: string): boolean =>
  [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));

const parse = (argv: string[]) =>
  parseFlags({
    argv,
    errorPrefix: "ttsc:",
    isPositional: isInputFile,
    subcommand: "build",
  });

/**
 * Verifies the launcher resolves a flag token to the same option the compiler
 * it wraps resolves it to.
 *
 * TypeScript's option parser matches option names case-insensitively and
 * accepts one or two leading dashes, so `--noemit`, `--NoEmit`, and `-noEmit`
 * are one option to tsgo. The launcher used to key its index on the exact
 * spelling, so a case variant fell through the unknown-flag escape hatch: tsgo
 * honoured the flag and every ttsc-side consumer of it stayed silent, with no
 * diagnostic. The negative twins pin the boundary — an unknown flag, a
 * near-miss name, and a bare token must not be captured by the wider lookup.
 *
 * 1. Parse case, dash, inline, spaced, and alias spellings of ttsc-owned flags.
 * 2. Assert each resolves to the canonical flag with the canonical value.
 * 3. Assert an unknown flag, a near-miss flag name, and a bare token that spells a
 *    flag are still forwarded verbatim with their adjacency intact.
 */
export const test_ttsc_resolves_flag_spellings_the_compiler_treats_as_identical =
  () => {
    // Casing, on a boolean, a value flag, and an alias.
    assert.deepEqual([...parse(["--noemit"]).values], [["--noEmit", true]]);
    assert.deepEqual([...parse(["--Watch"]).values], [["--watch", true]]);
    assert.deepEqual(
      [...parse(["--outdir", "dist"]).values],
      [["--outDir", "dist"]],
    );
    assert.deepEqual(
      [...parse(["-P", "p/tsconfig.json"]).values],
      [["--tsconfig", "p/tsconfig.json"]],
    );

    // Boundary spellings: inline value, spaced boolean literal, inline alias,
    // and a single-dash long name.
    assert.deepEqual(
      [...parse(["--NOEMIT=false"]).values],
      [["--noEmit", false]],
    );
    assert.deepEqual(
      [...parse(["--NoEmit", "false"]).values],
      [["--noEmit", false]],
    );
    assert.deepEqual(
      [...parse(["-p=x.json"]).values],
      [["--tsconfig", "x.json"]],
    );
    assert.deepEqual([...parse(["-noEmit"]).values], [["--noEmit", true]]);

    // A launcher-only flag is normalized with the rest: it is consumed with its
    // value rather than reaching tsgo, which would reject it.
    const launcherOnly = parse(["--CWD", "dir", "a.ts"]);
    assert.deepEqual([...launcherOnly.values], [["--cwd", "dir"]]);
    assert.deepEqual(launcherOnly.positional, ["a.ts"]);

    // Negative twin: an unknown flag in any casing still reaches tsgo verbatim,
    // and its spaced value stays adjacent (the invariant closed issue #663 owns).
    const unknown = parse(["--sTrIcT", "--TARGET", "es2020", "a.ts"]);
    assert.deepEqual([...unknown.values], []);
    assert.deepEqual(unknown.passthrough, ["--sTrIcT", "--TARGET", "es2020"]);
    assert.deepEqual(unknown.positional, ["a.ts"]);

    // Negative twin: a near-miss name is not the flag it resembles.
    const nearMiss = parse(["--cwd2", "dir", "a.ts"]);
    assert.deepEqual([...nearMiss.values], []);
    assert.deepEqual(nearMiss.passthrough, ["--cwd2", "dir"]);

    // Negative twin: a bare token is never resolved as a flag, or the `out` of
    // `--target out` would masquerade as ttsc's `--out` and eat the file after
    // it now that the lookup ignores dashes.
    const bare = parse(["--target", "out", "x.ts"]);
    assert.deepEqual(bare.passthrough, ["--target", "out"]);
    assert.deepEqual(bare.positional, ["x.ts"]);
  };
