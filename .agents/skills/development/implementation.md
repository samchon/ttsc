# Implementation

Read this document before changing maintained source or package wiring. For test construction, read [testing.md](testing.md); for execution, read [validation.md](validation.md); for acknowledgment selection, read [evidence.md](evidence.md).

## Repair Discipline

Apply the [contracts skill](../contracts/SKILL.md) before changing maintained production source, reading the common checklist and the scoped topics relevant to the affected operations.

- When a failure disproves an implementation assumption, follow the [shortcut prohibitions](../contracts/common.md#prohibited-implementation-shortcuts) before adding another compensating path. Verify the cause, correct the owning behavior, and remove superseded compensations in the same repair. Do not wait for the same failure to recur before reassessing an assumption already shown false.
- **No whack-a-mole.** Patching the one case that surfaced is whack-a-mole, and so is repairing one symptom at a time as each rerun reveals the next, which [AGENTS.md's **Collect every symptom before correcting** rule](../../../AGENTS.md#attitude) forbids. Map every case the root cause can produce through the [consequence analysis](#consequence-analysis), and seal them all with coverage so the class of failure cannot recur.

## Work Rules

- Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every implementation decision.
- Match existing conventions. Before adding a file, function, or test, open a nearby peer and mirror its naming, location, and code style, don't create parallel structures.
- Respect existing package boundaries. Don't hardcode consumer-specific behavior into the compiler host.
- Plugin descriptors are JS; transform logic is Go. JS transform functions (e.g. `transformSource`, `transformOutput`) are not part of the public contract.
- `shim.go` files marked `gen_shims:hand-maintained` are not regenerated.
- When code behavior changes, update the matching page under `website/src/content/docs/` in the same change.
- Follow [final formatting](#final-formatting) for a pull request's formatter invocation.

## Final Formatting

Run `pnpm format` once in the pull request's final preparation for merge, after all known implementation, CI and review corrections are complete. Commit its output in the same pull request and push that head. Individual commits, intermediate validation, Individual Self-Review and repair passes do not invoke it. A task that does not include a pull request has no formatter invocation from this rule.

Complete the required final validation, Overall Self-Review and CI checks on the formatted head before merging. If they reveal another defect, correct it in the same pull request and inspect the correction's formatting without running `pnpm format` again. Repeat the required final gates on the new head; earlier green checks or a clean review do not cover that correction.

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

## Change Integrity

Treat tests, fixtures, snapshots, CI workflows, package wiring, dependencies, core algorithms, and generated baselines as part of the specification. Changing them requires an explicit user request or a clear product reason, and the final report must call it out.

For mechanical ports, migrations, or broad rewrites, preserve the existing algorithm and public behavior in reviewable slices. Prefer a concrete exemplar over abstract instructions, and inspect the diff before trusting a green test run.
