# Agent B Knowledge

Scope: `prepareExecution` post-build failures.

Findings: if build succeeds but emitted entry resolution or read fails, the
runtime output directory should still be removed.

Proposal accepted: clean runtime output on post-build preparation failures.
