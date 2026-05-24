# Agent E Knowledge

Scope: lint numeric precision.

Findings: huge decimal integer text can avoid useful `ParseFloat` behavior and
should be rejected by a spec-derived finite-number bound.

Proposal accepted: add the 309-digit guard and focused unit coverage.
