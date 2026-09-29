---
name: development
description: Defines ttsc's implementation procedures, testing, validation, and change integrity. Use before changing source, tests, fixtures, workflows, or package wiring. Engineering acknowledgment contracts belong to contracts.
---

# Development

## Contents

- [Repair Discipline](#repair-discipline)
- [Work Rules](#work-rules)
- [Source Structure](#source-structure)
- [Consequence Analysis](#consequence-analysis)
- [Plugin Configuration](#plugin-configuration)
- [Testing](#testing)
- [Validation](#validation)
- [Change Integrity](#change-integrity)
- [Evidence Adoption](#evidence-adoption)

## Repair Discipline

Apply the [contracts skill](../contracts/SKILL.md) before changing maintained production source, reading the common checklist and the scoped topics relevant to the affected operations.

- **No forcing a broken design.** When the same failure keeps returning under patch after patch, the design is wrong. Stop, find the root cause, and fix the design instead of looping forever on symptoms.
- **No whack-a-mole.** Patching the one case that surfaced is whack-a-mole, and so is repairing one symptom at a time as each rerun reveals the next, which [AGENTS.md's **Collect every symptom before correcting** rule](../../../AGENTS.md#attitude) forbids. Map every case the root cause can produce through the [consequence analysis](#consequence-analysis), and seal them all with coverage so the class of failure cannot recur.

## Work Rules

- Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every implementation decision.
- Match existing conventions. Before adding a file, function, or test, open a nearby peer and mirror its naming, location, and code style, don't create parallel structures.
- Respect existing package boundaries. Don't hardcode consumer-specific behavior into the compiler host.
- Plugin descriptors are JS; transform logic is Go. JS transform functions (e.g. `transformSource`, `transformOutput`) are not part of the public contract.
- `shim.go` files marked `gen_shims:hand-maintained` are not regenerated.
- When code behavior changes, update the matching page under `website/src/content/docs/` in the same change.
- For a pull request, run `pnpm format` once on the complete change before the final CI-validated merge head is pushed, then commit its result in that pull request. Do not run it for individual commits or after each correction. If a later correction is necessary, keep it formatted by inspection and the CI format check without another formatter run. A task that does not include a pull request has no formatter invocation from this rule.

## Source Structure

`packages/ttsc/src` follows the `@ttsc/evidence` `evidence/singular` and `evidence/documented` rules even though ttsc cannot install them on itself.

- **One public identity per file, named after it.** A file exports exactly one symbol, and the file name is that symbol's name. An `index.ts` or a documented re-export barrel is the only exception. Declarations merged under one name count once.
- **The export comes first.** Place it right after the imports. Private helpers, constants, and types it uses follow it.
- Public documentation follows the [meaningful documentation](../contracts/common.md#meaningful-documentation) principle.
- **Shared internals become one namespace.** When several helpers serve one concern, group them as a single `export namespace` in a file named after it, and export only the members used outside it. Do not add a second export beside the first.

## Consequence Analysis

This is the procedure behind [AGENTS.md's **Trace the consequence surface** and **Collect every symptom before correcting** rules](../../../AGENTS.md#attitude). Group every known symptom by cause, whether an issue reported it or a finished run produced it, and before changing code trace each cause through:

- every caller and downstream consumer;
- normal, error, and recovery state transitions;
- concurrency, caching, and generated output;
- Windows and POSIX behavior;
- compatibility constraints and boundary inputs.

Derive a case matrix from that trace: every writer and reader of the affected state against each path, state transition, and platform, with the expected outcome in each cell.

Trace the change itself the same way before making it. Every file, directory, write, event, or change in timing or order it introduces is new input to every other path that observes the same location, clock, or event, such as an upward directory walk, a directory listing, a file watcher, a cache key, or a timestamp comparison. Find each of those observers and add its cases to the matrix.

Cover every cell of the matrix with a positive, negative, or boundary test case, without expanding the user's product goal.

## Plugin Configuration

First-party plugin configuration lives in dedicated `*.config.{ts,cts,mts,js,cjs,mjs,json}` files, auto-discovered by upward walk from the entry. Shipped ttsc packages accept only `configFile` (an explicit path) beyond host-owned entry keys.

Do not add inline option keys to `@ttsc/banner`, `@ttsc/paths`, `@ttsc/strip`, or `@ttsc/lint`: package config has one typed, discoverable home in its config file.

## Testing

**One test case per file, named after what it asserts.** Applies to both layers.

- **Go unit tests:** keep them in `packages/*/test/` with one `Test*` per file. Run the real command entrypoint, such as `go run ./plugin`, so wrapper branches stay covered.
- **TypeScript e2e tests:** keep ordinary scenarios in `tests/test-*/src/features/`.
- **Native-plugin lanes:** when a suite builds real Go plugin binaries, put those scenarios in `tests/test-*/src/native-plugins/<category>/` so CI can isolate them. Keep cheap scenarios under `features/`.
- **Platforms:** a lane marked `everyOs` in `scripts/ci/validation-plan.cjs` runs on Linux, Windows, and macOS. Put a suite whose code reaches the filesystem, paths, or processes in such a lane. A case that holds only where a capability holds, such as a case-insensitive compiler or POSIX executable bits, returns early where it does not, and a lane of a platform that has it must run it: a case that no CI platform runs is not a test.
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

A test runs the code it concerns and asserts what that code does. Do not add a test or check script whose subject is the repository's own files: that a document lists every package, a README mentions an option, a workflow contains a step, a file exists, source text matches a pattern, or two committed files agree.

### Coverage, not happy paths

A test that only feeds a rule its own canonical output and asserts it is unchanged proves idempotency, not correctness. Each rule or predicate needs more than its happy path:

- **The transformation direction.** For a rule that rewrites X into Y, assert that a mangled or unformatted input produces the canonical output (input differs from output), not only that the canonical form round-trips unchanged.
- **A negative twin for every positive.** Wherever a predicate acts (hug, break, merge, autofix), pin an adjacent case one property away where it must NOT act. An over-match stays invisible until the counter-example exists.
- **Boundaries.** The empty case, the single-element case, the exact width limit, the deepest nesting, the modifier or annotation that flips the decision.
- **Oracle-derived expectations.** Take the expected output from the authoritative spec (the Prettier version the workspace pins for `format`, the upstream ESLint rule for a lint port), never from whatever the current code happens to emit. A snapshot written against the code's own output locks its bugs in.

This is not a formatter-only rule. The same happy-path bias hides autofix corruption and edge-case faults across the lint set, so every rule carries the burden.

## Validation

Run the narrowest command that proves the change first, then a broader command when shared behavior or packaging changed. Report any command that could not be run.

Under [AGENTS.md's **Collect every symptom before correcting** rule](../../../AGENTS.md#attitude), a run has finished only when every case it selects has run, apart from cases blocked by a failure they depend on, such as tests behind a broken build. A runner that stops at its first failure skips cases nothing blocked, so it has not finished: `pnpm test:features` is a recursive `pnpm` run that skips every test package after the first failing one, and `pnpm test` chains its steps with `&&`. Run what they skipped before the [consequence analysis](#consequence-analysis) begins.

Verification shape depends on the change type:

- **Bug fix**: name the failing case and the expected behavior; run a repro that fails before the fix and passes after.
- **Feature**: name the observable behavior; exercise it end-to-end.
- **Refactor**: name what should stay unchanged; rely on the existing test suite or a behavior-locking probe.
- **Review**: name concrete risks, missing tests, or regressions.

## Change Integrity

Treat tests, fixtures, snapshots, CI workflows, package wiring, dependencies, core algorithms, and generated baselines as part of the specification. Changing them requires an explicit user request or a clear product reason, and the final report must call it out.

For mechanical ports, migrations, or broad rewrites, preserve the existing algorithm and public behavior in reviewable slices. Prefer a concrete exemplar over abstract instructions, and inspect the diff before trusting a green test run.

## Evidence Adoption

The root `evidence.json` owns production selection and references the [common engineering contracts](../contracts/common.md). Run `pnpm evidence` independently to check those declarations.

The JSON configuration avoids evaluating configuration through the compiler this repository is developing. This keeps the checker usable before that compiler has been built.

While the maintainer has deferred test integration, keep Evidence independent of test source, test configurations, `pnpm test`, `test:*` scripts, CI workflows, and their validation planner. That boundary lets concurrent test work proceed without a new gate or a changed source population.

During draft adoption, report all outstanding obligations and any incomplete analysis. The report must distinguish a functioning checker from completed enforcement of the selected production code.

1. Run the complete check and collect its entire report before correcting findings, following [AGENTS.md's symptom-collection rule](../../../AGENTS.md#attitude). Group missing acknowledgments, code or documentation defects, selection mistakes, generated-source provenance, and incomplete analysis by cause so one correction addresses the verified class of failure.
2. Inspect the selected declarations and their private helpers against each applicable principle. Fix verified defects within the authorized scope before writing an acknowledgment, because the tag must describe the resulting implementation. Generic compliance tags or weaker selection and severity can hide the defect while making the report pass.
3. Write `@evidence .agents/skills/contracts/common.md#<anchor> <reason>` in native documentation, addressing every fact the referenced section asks to acknowledge. One section may combine several related checks; the checker cannot judge the completeness or truth of its prose. Use `@evidenceExclude` only for a genuinely inapplicable individual item with a reason; whole-document exclusion would bypass every obligation for that host.
4. Use `pnpm exec evidence list --config evidence.json` to inspect selected public addresses and `pnpm exec evidence inspect '<target>' --config evidence.json` to investigate resolution. These commands show what the checker can address. Record private-helper and script-body limitations so whole-surface review covers what the graph cannot select.
5. Recheck the complete selected population after each coherent correction, because a changed declaration or selector can affect other obligations. Keep the issue open and the pull request draft while obligations or incomplete analysis remain. Record progress through the pull-request skill's formal review ledger so the pending work is visible.

Exclude generated, copied, dependency, build, and test material through explicit selection with verified provenance. Those files have a different author or validation owner; they must not acquire obligations accidentally through a broad glob.

A hand-maintained shim or authored helper remains maintained source even beside generated files. Test and benchmark enrollment requires its own authorized scope.

The [scoped contracts](../contracts/SKILL.md) guide review of their named operations. Before enrolling one, verify its selected public hosts through `list` and `inspect`, keep unrelated declarations outside that added claim, and record which private helpers remain review-only. Reference its own document rather than every topic in the skill. Until that selection is verified and committed, report the topic as review guidance, not automated enforcement.
