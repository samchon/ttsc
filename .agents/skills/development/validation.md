# Validation

Read this document when choosing or completing verification commands. Test construction belongs to [testing.md](testing.md), and selection checks belong to [evidence.md](evidence.md). The [validation README](../../../scripts/ci/README.md) owns CI execution, platform selection, caching and duration acceptance. Follow its execution contract instead of adding lanes to make repeated work appear shorter.

## Verification Commands

Run the narrowest command that proves the change first, then a broader command when shared behavior or packaging changed. Report any command that could not be run.

Under [AGENTS.md's **Collect every symptom before correcting** rule](../../../AGENTS.md#attitude), a run has finished only when every case it selects has run, apart from cases blocked by a failure they depend on, such as tests behind a broken build. A runner that stops at its first failure skips cases nothing blocked, so it has not finished: `pnpm test:features` is a recursive `pnpm` run that skips every test package after the first failing one, and `pnpm test` chains its steps with `&&`. Run what they skipped before the [consequence analysis](implementation.md#consequence-analysis) begins.

Verification shape depends on the change type:

- **Bug fix**: name the failing case and the expected behavior; run a repro that fails before the fix and passes after.
- **Feature**: name the observable behavior; exercise it end-to-end.
- **Refactor**: name what should stay unchanged; rely on the existing test suite or a behavior-locking probe.
- **Review**: name concrete risks, missing tests, or regressions.

## Inputs And Results

Record the source and fixture state used by a run. Coordinate shared writers before execution, and retain an immutable input snapshot when the run must outlive edits. If inputs change during execution, identify the affected cases and verify them against the final state; results from different source states do not establish one verified change.

Read each completed command's full result and report selected cases, failures, blocked or skipped cases and commands that could not run. Recheck the affected selection after a coherent correction, then broaden only when shared behavior, packaging or an unresolved concern requires it.
