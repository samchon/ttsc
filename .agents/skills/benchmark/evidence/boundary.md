# Operator Boundary

What you, the operator, may and may not change. A cell's limits are in [integrity.md](integrity.md).

Never change, whatever you find:

- any `tsconfig.json` or `lint.config.ts`, or `main`, `exports`, `publishConfig`, a top-level `types`, or an export subpath of a `package.json`, under `benchmarks/evidence/template/**`;
- `benchmarks/evidence/requirements/**`;
- a measured workspace, or the cell's reasoning: no prompting, advice, weakened gates, subject answers, or Evidence material shown to Plain.

If you believe a frozen file must change, report the file and line and wait for an instruction naming it.

| Path | When you may fix it |
| --- | --- |
| `benchmarks/evidence/src/**` | Any time; commit first, since a resume needs a clean descendant of the cell's `benchmarkRevision`. |
| `benchmarks/evidence/instructions/**` | Only while no live cell will reach the changed instruction. |
| The rest of `benchmarks/evidence/template/**` | Any time; it affects future launches only. |

Commit and push each correction in the campaign pull request. A defect in an instruction after `backend-start` is fixed by deriving a run ([recovery.md](recovery.md)), never by restarting.
