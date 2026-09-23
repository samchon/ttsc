# Cell Integrity

A cell edits its own workspace. That is the measurement, not a violation of it.

Only the edits the cell's **own** instructions forbid void the measurement. The rules that bind the operator in [intervention/boundary.md](../intervention/boundary.md) do not bind a cell, and reading one as the other punishes a cell for doing exactly what it was told to do.

## Contents

- [What Governs A Cell](#what-governs-a-cell)
- [Legitimate, Never A Hit](#legitimate-never-a-hit)
- [A Hit](#a-hit)
- [Why These Decide The Measurement](#why-these-decide-the-measurement)
- [Publishing A Number](#publishing-a-number)
- [On A Confirmed Hit](#on-a-confirmed-hit)

## What Governs A Cell

The workspace carries its own contract, copied in at preparation. Read it there before reporting anything:

| Source in the workspace | What it freezes |
| --- | --- |
| `AGENTS.md` | Agent instructions, policy overrides, package names and scripts, **existing** dependency specifiers, package-manager and engine resolution, workspace routing, shared lint or compiler configuration, and the fixed gate runners |
| `.agents/skills/backend/SKILL.md` | The backend package's `tsconfig.json` and lint configuration, in the package and in `test/` alike: no adding, deleting, or editing, and no phase edit beyond the one the active arm's skill prescribes |
| `.agents/skills/evidence/SKILL.md` | All three claim configuration files and every claim object, except the three prescribed stagings, with `evidence/graph` held at `error` |
| `.agents/skills/review/*.md` | Each arm's own review duty, and they differ. Evidence: every configuration its scope document names against the baseline, the three prescribed stagings aside. Plain: any difference from the baseline in a scoped configuration file, a changed dependency included, is a finding to report and restore |

## Legitimate, Never A Hit

**Deleting a predeclared `disabled` property, together with the comment that marks it.** This is the Evidence arm's prescribed unlock, staged layer by layer by the arm's own skill; the workspace's `.agents/skills/evidence/backend.md` and `frontend.md` name each claim, its configuration, and the moment to delete it. A cell that never deletes one has failed to advance; a cell that deletes one on schedule is doing its job.

```diff
           symbol: ["model"],
         },
       ],
-      // Remove after every controller contract is complete and build:sdk passes.
-      disabled: true,
```

**Staging `evidence/todo` from `"off"` to `"error"`, together with the comment that marks it.** This is the Evidence arm's second prescribed edit, in `packages/backend/test/lint.config.ts` only. The backend declares its contracts as stubs before any provider exists, so the rule ships off and the arm's own `backend.md` names the moment to raise it. A cell that never raises it has skipped a step, not obeyed a boundary.

```diff
     "evidence/singular": "error",
-    // A controller stub marks the work it has not realized with `@todo`, and
-    // ... Set this to "error" once every public-operation test is written ...
-    "evidence/todo": "off",
+    "evidence/todo": "error",
```

Raising any other severity, or lowering this one again, is a hit.

**Staging `evidence/review` from `"off"` to `"error"`, together with the comment that marks it.** This is the Evidence arm's third prescribed edit, in all three claim configurations. A review states what was checked, and the checks happen in each layer's Review, so the rule ships off and the arm's own `review/backend.md` and `review/frontend.md` name the moment their layer raises it. Every acknowledgement then reports itself unreviewed until that Review reaches it, and that report is the cell's worklist.

```diff
     "evidence/graph": ["error", graph],
-    // A review states what was checked, which the reason does not. It ships
-    // ... Set this to "error" there, and every acknowledgement reports itself
-    // as unreviewed until that Review reaches it.
-    "evidence/review": "off",
+    "evidence/review": "error",
```

Lowering it again after a Review raised it is a hit. The staged `"off"` in the baseline is not.

**Adding a new dependency.** The workspace's `AGENTS.md` freezes _existing_ dependency specifiers, package names, and scripts, not the act of installing something new, and `.agents/skills/frontend/SKILL.md` says outright to add a dependency once a concrete need appears.

```diff
   "dependencies": {
     "@nestia/fetcher": "catalog:samchon",
+    "date-fns": "^4.1.0",
     "typia": "catalog:samchon"
   },
```

The cell's own review skill is stricter than that, and deliberately so: `review/backend.md` and `review/frontend.md` tell a Plain cell that any difference from the baseline in an API or backend configuration file is a finding to report and restore, naming a changed dependency among them. **That stricter rule is the cell's to apply, not yours.** A cell that installs a package and never reconciles it has failed its own review, which its review verdict judges. Warning it would inject a finding, and [intervention/warning.md](../intervention/warning.md) forbids the warning channel from carrying one.

So neither belongs in an operator report. Flagging either is a false positive that costs a cell a warning it did not earn and, in the dependency case, tells it something its own review was supposed to reach on its own.

**All three prescribed edits are Evidence-only.** The base template declares no claim, no `disabled` property, and no `evidence/*` rule; all of them arrive with the Evidence overlay, in `packages/api/lint.config.ts`, `packages/backend/test/lint.config.ts`, and `packages/frontend/lint.config.ts`. A Plain cell therefore has no legitimate `lint.config.ts` edit at all, and any difference from its baseline is a hit.

## A Hit

Re-read these in every cell on every supervision cycle, diffing against the run's baseline commit.

### `tsconfig.json`

Any change at all, in either arm, at any nesting level. `include`, `exclude`, `rootDir`, `paths`, and `extends` decide which files enter a Program, and a claim populates only from the Program that owns it. A file dropped from `include` removes the hosts or targets a claim depended on, and the claim then passes while checking nothing.

### `lint.config.ts`

Diff against the baseline, discard the three prescribed edits and their marking comments, and report whatever remains. Every other difference is a hit even when the claim still exists and the build still passes:

- A reintroduced `disabled`.
- A changed claim, selector, or reference glob.
- A lowered severity, including anything below `error` on `evidence/graph`.
- A deleted claim.

```diff
-      files: ["src/controllers/**/*.ts"],
+      files: ["src/controllers/health.controller.ts"],
```

### `package.json`

`.agents/skills/backend/SKILL.md` gives the cell the exact shape and the rule in one line: **never change `main`, `exports`, or `publishConfig`.** Any difference in those three is a hit.

The trap is that the baseline legitimately points at build output, in `publishConfig` and only there. Read the two levels separately before reporting:

```json
{
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "publishConfig": {
    "main": "./lib/index.js",
    "types": "./lib/index.d.ts",
    "exports": { ".": { "types": "./lib/index.d.ts", "default": "./lib/index.js" } }
  }
}
```

That is `packages/api/package.json` as committed. The top level resolves to source so every workspace package reads current TypeScript; `publishConfig` switches the same root to compiled output when the package is packed. Neither half is a hit as it stands, and reporting the baseline's `lib` paths is a false positive.

A hit looks like this, where the top level now resolves to build output, so a local package can read a missing or stale build:

```json
{
  "main": "./lib/index.js",
  "types": "./lib/index.d.ts",
  "exports": { ".": "./lib/index.js" }
}
```

A newly added top-level `types` is a hit on its own, and so is any edit inside `publishConfig`.

Redirecting the SDK package to `lib` breaks the frozen glob that selects the accessor surface, and gives the cell a reason to edit the claim that depends on it. Check every package for it, not `packages/api` alone.

**A new subpath in `exports` is a hit too**, and the API package is where it happens. `.agents/skills/api/SKILL.md` and `.agents/skills/project/SKILL.md` both forbid publishing or consuming a `structures` subpath, because a second export surface creates a second contract path, and the accessor-surface glob selects through the first one only.

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./structures": "./src/structures/index.ts"
  }
}
```

**A changed `name` or `scripts`, or a changed existing dependency specifier**, is also a hit. A newly added dependency is not; that one belongs to the cell's own review.

### Workspace And Toolchain

`pnpm-workspace.yaml`, `.node-version`, and the root `packageManager` are frozen by the workspace `AGENTS.md` as workspace routing and package-manager or engine resolution. Report any change.

`pnpm-workspace.yaml` is the one a cell has a plausible reason to touch: adding a dependency through a `catalog:` specifier means adding the catalog entry here, which is a hit even though the dependency itself is not. The cell installs with an explicit version instead.

The runner's own review manifest reaches further than these: `config/lint.config.ts`, `config/package.json`, `config/tsconfig.json`, `packages/backend/nestia.config.ts`, `packages/backend/prisma.config.ts`, and `packages/backend/.env.example` are all configuration the cell must read and reconcile. Those belong to the cell's review, not to your hit criteria; `EvidenceBenchmarkReviewLedger.ts` holds the full list.

## Why These Decide The Measurement

Together these files decide what each Program contains and where a package resolves to, and so they decide what every evidence population selects from. That is why a change no one asked for voids the measurement instead of failing it: an empty population demands nothing, and a claim that reaches that state reports full coverage while checking nothing.

## Publishing A Number

Derive every published figure a second way and compare the two before it leaves the record.

A generator reports what it read, and a reading can be correct and still answer a different question than the one the table's column implies. Per-stage sums against a cell total, a token figure against the thread counter it came from, and an elapsed figure against the interval it spans each cost one command and each catches a class the generator cannot catch about itself.

Publish the figure only when both derivations agree. When they disagree, publish neither and report the disagreement, because the one thing that must never reach a reader is a number nobody can reproduce.

## On A Confirmed Hit

Warn the cell and resume it. Never restart it, and never repair the workspace yourself. [intervention/warning.md](../intervention/warning.md) owns the channel and its contents.

Quote the diff you read in the report. A hit asserted without the diff is the kind of unproven claim this product exists to reject.
