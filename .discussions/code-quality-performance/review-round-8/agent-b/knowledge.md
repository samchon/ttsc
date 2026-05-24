# Agent B Knowledge

Scope: runtime and LSP final review.

Findings:

- `prepareExecution` failed-preparation cleanup is scoped to the per-run
  runtime directory.
- `runTtsx` cleanup is best-effort and preserves child status.
- The LSP hard-error test covers sibling-stream closure.

Outcome: no surviving proposal.
