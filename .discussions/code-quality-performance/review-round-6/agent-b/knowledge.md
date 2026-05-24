# Agent B Knowledge

Scope: `ttsx` preparation cleanup, runtime cleanup, LSP frame wording, and
proxy hard-error behavior.

Findings:

- Successful execution cleanup is best-effort and does not replace the child
  exit status.
- Failed type-check preparation now removes the per-run runtime output.
- The proxy hard-error test covers sibling-pump shutdown without pre-closing the
  opposite stream.

Proposal: add an observable TypeScript feature assertion for failed-check
cleanup under an explicit `--cache-dir`.
