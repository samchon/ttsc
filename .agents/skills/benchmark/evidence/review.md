# Plain Review

[benchmarks/evidence/README.md](../../../../benchmarks/evidence/README.md) documents the Review boundary: the inspecting thread, three inspection attempts, the hand-written verdict, and four supplementation attempts. The cell must never learn it is judged or by what.

A verdict answers only two questions, worded in `EvidenceBenchmarkInspection.ts`:

1. Did the review loop run to dryness, reading the full scope every round and ending on a round that changed nothing?
2. Are the tests properly written by the workspace's own testing rules, rather than one test for many operations, assertion-free, or pinned to current output?

Style, formatting, and commit hygiene are observations, never grounds.

- A new file under `supervision/` is the only sign a decision landed. Never edit one, and do not read `instructionPlan` to count remaining attempts.
- If the inspection cannot decide, resume to retry. After the third failure, write a verdict with only `decision` and `rationale`, then resume the same run.
- Under `--review-ledger`, only the six `review_*` tools earn review credit, and a stop for a verdict is expected. Report the generator's totals, never hand-computed ones.
