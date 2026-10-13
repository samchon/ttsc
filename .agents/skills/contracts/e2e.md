# E2E Contracts

These chapters add to the [test contracts](testing.md) for real-boundary tests.

## Necessary boundary

Keep parsing, rules, options, and state logic in units, and only a minimal real check of assembly, transport, installation, or host behavior here. Invoking a CLI or building Go is not a reason by itself.

State the components and connection exercised and the failure direct unit calls cannot detect.

## Shared execution

Batch cases around the fewest installations, builds, project loads, and host sessions; Go contributor semantics must not rebuild or relaunch a host per rule or input. Separate jobs or workers do not remove repeated work, and each case's failure stays observable.

State which preparation this case reuses and what changed input justifies any extra one.

## State isolation and reuse validity

Share a preparation only among consumers with equivalent inputs and effects, and keep a real cold or invalidated state when that transition is under test. Prefer a bounded reset to wholesale cache deletion or per-case rebuilds.

State the artifact identity, cache inputs and invalidation, mutable state, and the reset that keeps an earlier case from deciding a later one, and who ends each shared process, handle, and directory on success, failure, and cancellation.

## Preserved coverage

When moving or merging scenarios, keep every valid distinction, failure path, and boundary. Fewer cases, a green run, or a shorter time is not evidence of equal coverage.

State where each surviving assertion lives.
