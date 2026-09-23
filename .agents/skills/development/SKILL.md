---
name: development
description: Defines how ttsc changes code, covering forbidden shortcuts, work rules, source structure, consequence analysis, testing, validation, and change integrity. Use before writing or changing source, tests, workflows, package wiring, fixtures, generated baselines, or algorithms.
---

# Development

## Contents

- [Forbidden](#forbidden)
- [Work Rules](#work-rules)
- [Source Structure](#source-structure)
- [Consequence Analysis](#consequence-analysis)
- [Plugin Configuration](#plugin-configuration)
- [Testing](#testing)
- [Validation](#validation)
- [Change Integrity](#change-integrity)

## Forbidden

These four are never acceptable; choosing any one means the approach is already wrong.

- **No monkey-patching or hardcoding.** Don't special-case a consumer, a fixture name, or an expected value to make output match. Fix the general logic.
- **No test-passing-only logic.** Code exists to be correct, not to turn a check green. A branch whose only purpose is to satisfy one assertion is a bug in disguise.
- **No forcing a broken design.** When the same failure keeps returning under patch after patch, the design is wrong. Stop, find the root cause, and fix the design instead of looping forever on symptoms.
- **No whack-a-mole.** Don't patch the one case that surfaced and move on. Find every case the same root cause can produce, and seal them all with coverage so the class of failure cannot recur.

## Work Rules

- Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every implementation decision.
- Match existing conventions. Before adding a file, function, or test, open a nearby peer and mirror its naming, location, and code style, don't create parallel structures.
- Respect existing package boundaries. Don't hardcode consumer-specific behavior into the compiler host.
- Plugin descriptors are JS; transform logic is Go. JS transform functions (e.g. `transformSource`, `transformOutput`) are not part of the public contract.
- `shim.go` files marked `gen_shims:hand-maintained` are not regenerated.
- When code behavior changes, update the matching page under `website/src/content/docs/` in the same change.
- Run `pnpm format` before every ordinary commit and stage the result; never commit unformatted output. An issue campaign instead formats at the points its [development procedure](../issue-campaign/development.md) names, the integrated snapshot and each later correction, never each issue commit.

## Source Structure

`packages/ttsc/src` follows the `@ttsc/evidence` `evidence/singular` and `evidence/documented` rules even though ttsc cannot install them on itself.

- **One public identity per file, named after it.** A file exports exactly one symbol, and the file name is that symbol's name. An `index.ts` or a documented re-export barrel is the only exception. Declarations merged under one name count once.
- **The export comes first.** Place it right after the imports. Private helpers, constants, and types it uses follow it.
- **Every public unit carries a JSDoc block.** This covers the export itself and its public members: interface properties, public class members, and namespace members. Write the context a human or an agent needs to start from: what it answers, why it exists, and which invariant it keeps.
- **Shared internals become one namespace.** When several helpers serve one concern, group them as a single `export namespace` in a file named after it, and export only the members used outside it. Do not add a second export beside the first.

## Consequence Analysis

Treat a reported example as one witness of a cause, not the complete problem statement. Before changing code, trace the same cause through:

- every caller and downstream consumer;
- normal, error, and recovery state transitions;
- concurrency, caching, and generated output;
- Windows and POSIX behavior;
- compatibility constraints and boundary inputs.

Fix the verified class of failure, not only the reported witness. Cover positive, negative, and boundary cases without expanding the user's product goal.

## Plugin Configuration

First-party plugin configuration lives in dedicated `*.config.{ts,cts,mts,js,cjs,mjs,json}` files, auto-discovered by upward walk from the entry. Shipped ttsc packages accept only `configFile` (an explicit path) beyond host-owned entry keys.

Do not add inline option keys to `@ttsc/banner`, `@ttsc/paths`, `@ttsc/strip`, or `@ttsc/lint`: package config has one typed, discoverable home in its config file.

## Testing

**One test case per file, named after what it asserts.** Applies to both layers.

- **Go unit tests:** keep them in `packages/*/test/` with one `Test*` per file. Run the real command entrypoint, such as `go run ./plugin`, so wrapper branches stay covered.
- **TypeScript e2e tests:** keep ordinary scenarios in `tests/test-*/src/features/`.
- **Native-plugin lanes:** when a suite builds real Go plugin binaries, put those scenarios in `tests/test-*/src/native-plugins/<category>/` so CI can isolate them. Keep cheap scenarios under `features/`.
- **TypeScript test contract:** export exactly one `test_<snake_case>` function from a matching filename. `DynamicExecutor` discovers that prefix. Materialize a temporary project, spawn the real binary, and assert observable output.

Open every case with a doc comment in the same three-part shape: a one-line `Verifies …` headline, a short paragraph stating the non-obvious _why_ (which branch or regression is being pinned), and a 2–4-step numbered list summarizing the scenario.

```ts
/**
 * Verifies plugin corpus: composes rejects cycle between two plugins.
 *
 * Locks the cycle-detection branch in
 * `loadProjectPlugins.ts::composePluginSources`. Composition is one hop only;
 * reciprocal `composes` arrays would silently reswap the binaries of both
 * plugins, so ttsc throws an explicit error instead of routing to the wrong
 * binary.
 *
 * 1. Two plugin descriptors each list the other in `composes`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and `composes cycle detected` in stderr.
 */
export const test_plugin_corpus_composes_rejects_cycle_between_two_plugins =
  () => {
    /* ... */
  };
```

Use the shared helpers in `tests/utils` and the per-suite `internal/` modules; do not reach into another suite's internals. Regressions that need a real directory layout (not just a synthetic temp file map) go under `tests/projects`.

Commit only tests that are meaningful and necessary to verify the change. Scratch probes and one-off checks you ran while working stay out of the repository.

### Coverage, not happy paths

A test that only feeds a rule its own canonical output and asserts it is unchanged proves idempotency, not correctness. Each rule or predicate needs more than its happy path:

- **The transformation direction.** For a rule that rewrites X into Y, assert that a mangled or unformatted input produces the canonical output (input differs from output), not only that the canonical form round-trips unchanged.
- **A negative twin for every positive.** Wherever a predicate acts (hug, break, merge, autofix), pin an adjacent case one property away where it must NOT act. An over-match stays invisible until the counter-example exists.
- **Boundaries.** The empty case, the single-element case, the exact width limit, the deepest nesting, the modifier or annotation that flips the decision.
- **Oracle-derived expectations.** Take the expected output from the authoritative spec (the Prettier version the workspace pins for `format`, the upstream ESLint rule for a lint port), never from whatever the current code happens to emit. A snapshot written against the code's own output locks its bugs in.

This is not a formatter-only rule. The same happy-path bias hides autofix corruption and edge-case faults across the lint set, so every rule carries the burden.

## Validation

Run the narrowest command that proves the change first, then a broader command when shared behavior or packaging changed. Report any command that could not be run.

Verification shape depends on the change type:

- **Bug fix**: name the failing case and the expected behavior; run a repro that fails before the fix and passes after.
- **Feature**: name the observable behavior; exercise it end-to-end.
- **Refactor**: name what should stay unchanged; rely on the existing test suite or a behavior-locking probe.
- **Review**: name concrete risks, missing tests, or regressions.

## Change Integrity

Treat tests, fixtures, snapshots, CI workflows, package wiring, dependencies, core algorithms, and generated baselines as part of the specification. Changing them requires an explicit user request or a clear product reason, and the final report must call it out.

For mechanical ports, migrations, or broad rewrites, preserve the existing algorithm and public behavior in reviewable slices. Prefer a concrete exemplar over abstract instructions, and inspect the diff before trusting a green test run.
