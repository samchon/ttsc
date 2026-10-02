import assert from "node:assert/strict";

import { buildGoAllowList } from "../../../../../packages/ttsc/src/flags/buildGoAllowList";

/**
 * Verifies native allow-list derivation preserves lane membership and arity.
 *
 * Literal maps describe the public host and lint argument contracts, rather
 * than deriving expectations from FLAG_SCHEMA or comparing generated files.
 * A caller may mutate its returned map without changing later derivations.
 *
 * 1. Require every host key, project alias and boolean/value classification.
 * 2. Require the lint-only inputs and exclude the host-only manifest key.
 * 3. Mutate both returned maps and require fresh calls to retain the contracts.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual buildGoAllowList export for both native lanes and asserts complete normalized key/arity maps, then changes caller-owned entries and requires independent fresh results.
 * @evidence contracts/testing.md#independent-expectations Independently authored literal host and lint maps encode their public project, emit, threading and transport contracts. No schema enumeration, generated Go file or normalization helper computes these expectations; wrong aliases, casing, arity, missing entries and extra foreign-lane entries fail map equality.
 * @evidence contracts/testing.md#distinguishing-cases The project canonical name and two aliases require value tokens; emit, noEmit, quiet, verbose and singleThreaded are booleans. Manifest belongs only to host; diagnostics, extendedDiagnostics, project-context-json, file and out belong only to lint. Launcher-only and forwarded compiler-only entries are excluded by the complete maps. Mutating one result neither changes the other lane nor a later call. The current supported schema has no valueOptional or conflicting-arity row, so this unit does not claim those synthetic branches.
 * @evidence contracts/testing.md#execution-ownership A directly discoverable TypeScript unit imports the owning source adapter and constructs no consumer, process, Go artifact or fixture filesystem. It validates derivation, not native parsing, generator rendering or generated-file freshness.
 */
export function test_go_allow_lists_preserve_native_lane_membership_and_value_arity(): void {
  const expectedHost = new Map<string, boolean>([
    ["tsconfig", true],
    ["p", true],
    ["project", true],
    ["cwd", true],
    ["emit", false],
    ["noemit", false],
    ["outdir", true],
    ["quiet", false],
    ["verbose", false],
    ["singlethreaded", false],
    ["checkers", true],
    ["tsgo-args", true],
    ["plugins-json", true],
    ["manifest", true],
  ]);
  const expectedLint = new Map<string, boolean>([
    ["tsconfig", true],
    ["p", true],
    ["project", true],
    ["cwd", true],
    ["emit", false],
    ["noemit", false],
    ["outdir", true],
    ["quiet", false],
    ["verbose", false],
    ["singlethreaded", false],
    ["checkers", true],
    ["diagnostics", false],
    ["extendeddiagnostics", false],
    ["tsgo-args", true],
    ["plugins-json", true],
    ["project-context-json", true],
    ["file", true],
    ["out", true],
  ]);
  const host = buildGoAllowList("host");
  const lint = buildGoAllowList("lint");
  assert.deepEqual(host, expectedHost);
  assert.deepEqual(lint, expectedLint);
  assert.notEqual(host, lint);

  host.delete("tsconfig");
  host.set("emit", true);
  host.set("foreign-caller-key", true);
  assert.deepEqual(lint, expectedLint);
  lint.clear();
  lint.set("manifest", false);

  const nextHost = buildGoAllowList("host");
  const nextLint = buildGoAllowList("lint");
  assert.notEqual(nextHost, host);
  assert.notEqual(nextLint, lint);
  assert.deepEqual(nextHost, expectedHost);
  assert.deepEqual(nextLint, expectedLint);
}
