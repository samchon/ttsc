# E2E Contracts

These chapters add to the test contracts for real-boundary tests.

## Necessary boundary

State the components and connection exercised and the failure direct unit calls cannot detect. Keep parsing, rules, options, and state logic in units, and only a minimal real check of assembly, transport, installation, or host behavior here. Invoking a CLI or building Go is not a reason by itself.

## Shared execution

Batch cases around the fewest installations, builds, project loads, and host sessions. State which preparation this case reuses and what changed input justifies any extra one; Go contributor semantics must not rebuild or relaunch a host per rule or input. Separate jobs or workers do not remove repeated work, and each case's failure stays observable.

## State isolation and reuse validity

Share a preparation only among consumers with equivalent inputs and effects. State the artifact identity, cache inputs and invalidation, mutable state, and the reset that keeps an earlier case from deciding a later one, and keep a real cold or invalidated state when that transition is under test. State who ends each shared process, handle, and directory on success, failure, and cancellation, preferring a bounded reset to wholesale cache deletion or per-case rebuilds.

## Preserved coverage

When moving or merging scenarios, keep every valid distinction, failure path, and boundary, and state where each surviving assertion lives. Fewer cases, a green run, or a shorter time is not evidence of equal coverage.
