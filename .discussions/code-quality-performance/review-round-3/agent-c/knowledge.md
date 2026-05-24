# Agent C Knowledge

Scope: LSP proxy hard errors.

Findings: one failed proxy pump must close sibling closeable streams so `Run`
cannot hang waiting for the other pump.

Proposal accepted: add hard-error sibling stream coverage.
