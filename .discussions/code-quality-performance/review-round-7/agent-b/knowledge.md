# Agent B Knowledge

Scope: runtime and LSP final review.

Findings:

- Failed preparation removes only the per-run runtime output.
- Successful execution cleanup remains best-effort.
- The updated failed-check test preserves the "entry not executed" assertion and
  adds cache cleanup verification.
- LSP hard-error coverage is a real regression test.

Outcome: no surviving proposal.
