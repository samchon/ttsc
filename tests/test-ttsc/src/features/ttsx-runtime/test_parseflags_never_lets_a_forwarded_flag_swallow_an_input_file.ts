import assert from "node:assert/strict";

import { parseFlags } from "../../../../../packages/ttsc/lib/flags/parser.js";

const isEntry = (token: string): boolean =>
  [".ts", ".tsx", ".mts", ".cts"].some((ext) => token.endsWith(ext));

/**
 * Verifies the forwarding path never removes an input file from `positional` on
 * behalf of a flag that does not own it.
 *
 * `ParseOptions.isPositional` documents itself as "the only signal that
 * separates a forwarded value from a real input file", but
 * `forwardKnownButUnaccepted` — which answers the same question for a
 * schema-known flag this subcommand does not accept — never consulted it and
 * took the next bare token whenever the flag's kind was not boolean. That
 * branch runs before the main loop's classification ever sees the token.
 * Correcting only the one flag whose declared kind was wrong would clear the
 * reachable witness and leave the branch that made it reachable. The sibling of
 * `test_parseflags_keeps_the_ttsx_entry_after_a_spaced_flag_value`, which pins
 * the same rule for the _unknown_-flag class.
 *
 * 1. Parse a schema-known, launcher-unaccepted value flag followed by a TypeScript
 *    file.
 * 2. Assert the file stays positional and only the flag is forwarded.
 * 3. Assert the negative twin — the same flag followed by a non-file token — still
 *    forwards the pair adjacently, and a genuine launcher value flag still
 *    consumes its value.
 */
export const test_parseflags_never_lets_a_forwarded_flag_swallow_an_input_file =
  () => {
    // `--out` is declared for build/check and consumed by the lint sidecar, so
    // the ttsx lane forwards it: exactly the class that reached the branch.
    const swallowed = parseFlags({
      argv: ["--out", "entry.ts"],
      errorPrefix: "ttsx:",
      forwardAfterFirstPositional: true,
      honorDoubleDashSeparator: true,
      isPositional: isEntry,
      subcommand: "ttsx",
    });
    assert.deepEqual(swallowed.positional, ["entry.ts"]);
    assert.deepEqual(swallowed.passthrough, ["--out"]);

    // Negative twin: a non-file value still travels with its flag, so tsgo and
    // the sidecars receive the pair in order and adjacency.
    const pair = parseFlags({
      argv: ["--out", "bundle.js", "entry.ts"],
      errorPrefix: "ttsx:",
      forwardAfterFirstPositional: true,
      honorDoubleDashSeparator: true,
      isPositional: isEntry,
      subcommand: "ttsx",
    });
    assert.deepEqual(pair.passthrough, ["--out", "bundle.js"]);
    assert.deepEqual(pair.positional, ["entry.ts"]);

    // Negative twin: a flag this subcommand *does* accept still owns its next
    // token, whatever that token looks like — the predicate governs forwarding,
    // not accepted-flag value resolution.
    const accepted = parseFlags({
      argv: ["--cwd", "dir", "entry.ts"],
      errorPrefix: "ttsx:",
      forwardAfterFirstPositional: true,
      honorDoubleDashSeparator: true,
      isPositional: isEntry,
      subcommand: "ttsx",
    });
    assert.deepEqual([...accepted.values], [["--cwd", "dir"]]);
    assert.deepEqual(accepted.positional, ["entry.ts"]);
  };
