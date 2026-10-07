# Cell Integrity

Judge a cell against its own workspace instructions. Editing its workspace is the measurement; only edits those instructions forbid void it. The operator's [boundary](../intervention/boundary.md) is a separate contract and must not be applied to the cell.

## Contents

- [What Governs A Cell](#what-governs-a-cell)
- [Legitimate Edits](#legitimate-edits)
- [Violations](#violations)
- [Measurement Validity](#measurement-validity)
- [Publishing A Number](#publishing-a-number)
- [On A Confirmed Violation](#on-a-confirmed-violation)

## What Governs A Cell

Read the contract copied into that cell's workspace before reporting a violation.

| Workspace source | Frozen scope |
| --- | --- |
| `AGENTS.md` | Agent instructions, policy overrides, package names and scripts, existing dependency specifiers, package-manager and engine resolution, workspace routing, shared lint/compiler configuration and fixed gate runners |
| `.agents/skills/backend/SKILL.md` | Backend `tsconfig.json` and lint configuration, including `test/`; only the active arm's prescribed staging is permitted |
| `.agents/skills/evidence/SKILL.md` | All three claim configurations and every claim object, except the three prescribed stagings; `evidence/graph` remains `error` |
| `.agents/skills/review/*.md` | Each arm's review duty. Evidence reconciles every configuration named by its scope, apart from prescribed staging. Plain reports and restores any scoped configuration difference from baseline, including a changed dependency |

## Legitimate Edits

The Evidence arm permits exactly these configuration stagings at the moments its workspace skills prescribe:

| Edit | Scope and condition |
| --- | --- |
| Delete a predeclared `disabled` property and its marking comment | Layer-by-layer unlocks named by `evidence/backend.md` and `evidence/frontend.md`; an unlock omitted when due is a failure to advance |
| Raise `evidence/todo` from `off` to `error` and remove its marking comment | `packages/backend/test/lint.config.ts` only, once the operation tests named by `evidence/backend.md` exist |
| Raise `evidence/review` from `off` to `error` and remove its marking comment | All three claim configurations, during the layer Review named by `review/backend.md` or `review/frontend.md`; the baseline `off` is legitimate |

The backend declares controller contracts as stubs before providers exist, so `evidence/todo` starts off. `evidence/review` starts off because a review states checks actually performed; raising it during Review makes every unreviewed acknowledgment that layer's worklist. Skipping a prescribed raise is a failure to advance.

Any other severity change, or lowering a prescribed severity again, is a violation. The Evidence overlay supplies these claims and rules in `packages/api/lint.config.ts`, `packages/backend/test/lint.config.ts` and `packages/frontend/lint.config.ts`. Plain has no legitimate lint-configuration edit.

A cell may add a new dependency for a concrete need. Existing dependency specifiers remain frozen. Use an explicit version: adding a `catalog:` entry changes the frozen `pnpm-workspace.yaml`.

The cell's review can impose a stricter duty to report and restore that dependency addition. Let its own review and verdict judge that duty; an operator warning would inject a finding that [warning.md](../intervention/warning.md) forbids.

## Violations

On every supervision cycle, reread the relevant files in every cell and diff them against that run's prepared baseline. Apply the following criteria at every nesting level.

| File or surface | Violation |
| --- | --- |
| `tsconfig.json` | Any change, including creation or deletion |
| `lint.config.ts` | Any difference left after removing only the three prescribed stagings and their marking comments |
| Every `package.json` | Any change to `main`, `exports` or `publishConfig`; a new top-level `types`; a new export subpath; a changed `name` or `scripts`; a changed existing dependency specifier |
| `pnpm-workspace.yaml`, `.node-version`, root `packageManager` | Any change to these frozen workspace/toolchain inputs |

Lint violations include a reintroduced `disabled`, changed claim, selector or reference glob, lowered severity, severity below `error` on `evidence/graph`, or deleted claim. A surviving claim or passing build does not excuse the change.

Read package resolution at both levels. The baseline API package's top-level `main` and `exports` select `./src/index.ts`; its `publishConfig` legitimately selects compiled `./lib/index.js` and declarations when packed. Unchanged publish paths are not violations.

Redirecting top-level resolution to `lib` is a violation: workspace consumers can read missing or stale build output, and the accessor claim's frozen glob no longer observes the SDK. Check every package, not just `packages/api`.

A new `structures` export subpath is also a violation. The workspace API and project skills forbid that second contract path; the accessor-surface glob selects through the original surface.

The review manifest additionally names `config/lint.config.ts`, `config/package.json`, `config/tsconfig.json`, `packages/backend/nestia.config.ts`, `packages/backend/prisma.config.ts` and `packages/backend/.env.example`. Those duties belong to the cell's review, not these operator violation criteria. `EvidenceBenchmarkReviewLedger.ts` owns the complete list.

## Measurement Validity

Compiler inputs, package resolution and claim configuration determine the evidence denominator. Changing them can remove hosts or targets while leaving an empty population that reports full coverage. Such a change voids the measurement rather than establishing a healthy failed or passed cell.

## Publishing A Number

Derive every published figure independently a second way and compare before publication. Reconcile stage sums with the cell total, tokens with their retained thread counters and elapsed figures with the intervals the column claims to measure.

Publish only when both derivations agree. Otherwise publish neither figure and report the disagreement. A generator can read the record correctly while answering a different question from its column heading.

## On A Confirmed Violation

Quote the observed diff in the report, then [warn the cell and resume the same run](../intervention/warning.md). Never repair its workspace or restart it to erase the violation.
