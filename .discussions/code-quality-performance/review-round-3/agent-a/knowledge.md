# Agent A Knowledge

Scope: ttsx runtime cleanup.

Findings: cleanup should be best-effort so filesystem failures cannot replace
the child process exit status.

Proposal accepted: make `runPreparedEntry` cleanup best-effort.
