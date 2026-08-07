# Evidence vendoring tools

`@ttsc/evidence`, its benchmark, and its two feature suites are vendored from `samchon/lint-plugin-evidence` (published as `@samchon/lint-plugin-evidence`). Upstream keeps moving, so the copy has to be repeatable rather than hand-made.

These scripts are branch-local tooling for the migration pull request. They are not part of any build, lane, or published package.

## Refreshing the vendored trees

Upstream defaults to `D:/github/samchon/evidence`, which is where `samchon/lint-plugin-evidence` is cloned on this machine; the directory is not named after the repository. `parity.cjs` takes another location from its first argument, then from `EVIDENCE_UPSTREAM`, so a checkout that lives elsewhere needs no edit. The argument wins, and it is what the `robocopy` recipe's `<upstream>` placeholder below stands for; neither the variable nor the argument feeds those copy commands.

This repository now carries corrections upstream does not. `robocopy /MIR` mirrors, so it deletes: everything the round-two preparation of ttsc#1096 changed inside a vendored tree is a local correction to a defect the first cohort exposed, and a refresh removes all of it unless it is reapplied.

`EXCEPTIONS` in `parity.cjs` is the list. Every round-two entry names the issue that owns it, so a refresh walks that list once and, for each entry, either reads upstream and finds the correction already there or reapplies it here from the issue. An entry that compares clean afterwards is reported as excused, which is how the list shrinks as upstream catches up rather than growing forever.

`readapt.cjs` carries none of them. It was not touched by that work, so a refresh reapplies every round-two entry by hand from its issue and nothing is picked up automatically. Encoding some of them there is possible and simply not done: its `edit()` is general anchored substitution and its step 3 writes whole files, so an anchored deletion, a one-sentence replacement, or a local-only file is exactly its shape. What no anchor survives is upstream restructuring the document it sits in, which is the argument its own step 6 makes and the reason the prose-heavy entries would not stay encoded for long.

```bash
# 1. Copy. Never exclude a directory named `lib` — the benchmark template ships
#    frontend sources in `src/lib`, and excluding it silently delivers a
#    workspace whose entry cannot resolve `@/lib/client`.
robocopy <upstream>/benchmark/src            benchmarks/evidence/src          /MIR /XD node_modules .git
robocopy <upstream>/benchmark/template       benchmarks/evidence/template     /MIR /XD node_modules .git
robocopy <upstream>/benchmark/requirements   benchmarks/evidence/requirements /MIR /XD node_modules .git
robocopy <upstream>/benchmark/instructions   benchmarks/evidence/instructions /MIR /XD node_modules .git
robocopy <upstream>/packages/evidence/src    packages/evidence/src            /MIR /XD node_modules .git
robocopy <upstream>/packages/evidence/native packages/evidence/native         /MIR /XD node_modules .git
robocopy <upstream>/tests/test-evidence/src  tests/test-evidence/src          /MIR /XD node_modules .git
robocopy <upstream>/tests/test-benchmark/src tests/test-evidence-benchmark/src /MIR /XD node_modules .git

# The two skills nest one level below their host skill, so upstream's own
# two-level shape survives the copy and every relative link inside it still
# resolves. Nothing re-flattens them and nothing rewrites their links.
robocopy <upstream>/.agents/skills/benchmark .agents/skills/benchmark/evidence /MIR /XD node_modules .git
copy     <upstream>/.agents/skills/evidence-graph/SKILL.md .agents/skills/project/evidence/SKILL.md

# Upstream's open campaign pull request carries live logic fixes that are not on
# master, and it moves while this branch is open. Take its product diff too; at
# the time of writing that is two files, and `git diff --name-only master...`
# against the branch is what decides. `parity.cjs` resolves the same ref rather
# than a commit, so a tip that has moved is reported instead of compared clean.
git -C <upstream> show origin/campaign-luna-0.6.0-cont:benchmark/src/EvidenceBenchmarkReconcile.ts \
  > benchmarks/evidence/src/EvidenceBenchmarkReconcile.ts
git -C <upstream> show origin/campaign-luna-0.6.0-cont:benchmark/src/executable/EvidenceBenchmarkReconcile.ts \
  > benchmarks/evidence/src/executable/EvidenceBenchmarkReconcile.ts

# 2. Re-apply every adaptation. Idempotent; ends in a measurement.
node experimental/evidence-vendor/readapt.cjs

# 3. Formatters. Go first, because upstream Go is tab-indented and this
#    repository pins two spaces and checks it.
bash ./.vscode/gofmt-2spaces.sh -w packages/evidence/native/*.go
npx prettier --write "packages/evidence/src/**/*.ts" \
  "benchmarks/evidence/src/**/*.ts" \
  "tests/test-evidence/src/**/*.ts" \
  "tests/test-evidence-benchmark/src/**/*.ts" \
  ".agents/skills/project/evidence/*.md" \
  ".agents/skills/benchmark/evidence/**/*.md"

# 4. Sweep for assumptions the copy carried over, then prove that every
#    remaining difference from upstream is a declared adaptation.
node experimental/evidence-vendor/audit.cjs
node experimental/evidence-vendor/parity.cjs
node experimental/evidence-vendor/parity.cjs <upstream>          # a checkout elsewhere
```

`parity.cjs` does not see `benchmarks/evidence/aggregate`. The aggregate is a measurement this repository publishes for itself, so its cells and `generatedAt` are expected to diverge from upstream's rather than to match them, and comparing the two would report a residual on every regeneration.

Do not run Prettier over `benchmarks/evidence/{template,requirements,instructions}`. `.prettierignore` exempts them, and the reason is in that file.

## What `readapt.cjs` does

0. Normalizes CRLF to LF, because robocopy preserves upstream line endings and a text anchor written with `\n` does not match a file carrying `\r\n`.
1. Renames identifiers and package names (`IEvidence` → `ITtscEvidence`, `@samchon/lint-plugin-evidence` → `@ttsc/evidence`, …), qualifies upstream issue numbers, and rewrites two comments that name documents this repository does not have.
2. Renames the files whose basenames carry those identifiers.
3. Writes `EvidenceBenchmarkLayout` and re-roots every benchmark path through it. Upstream sits at `<repository>/benchmark`, so one value answered both "which repository" and "where are the benchmark's own files". Here it cannot.
4. Restores `workspacePackageVersions`, which upstream deleted. See below.
5. Applies the suite-local adaptations (`benchmarkRoot`, manifest-driven dependency linking, re-based import paths, corrected prose).
6. Resolves every relative specifier in all five trees and prints the count.

### The one deletion that must not be taken

Upstream removed `workspacePackageVersions` from `EvidenceBenchmarkWorkspace`, and that is correct **for upstream**: it lists `ttsc`, `@ttsc/lint`, and `@ttsc/unplugin` in its own pnpm catalog, because there they are external dependencies, so a catalog lookup answers every `{{version:…}}` token.

Here they are the workspace itself, and a workspace never lists itself in a catalog. Without the manifest fallback, `{{version:ttsc}}` is unanswerable and `prepareWorkspace` throws before a cell writes anything. The script re-adds it.

This is the shape to watch for on every refresh: a blanket copy cannot tell an upstream change from an adaptation this workspace requires.

## `audit.cjs`

Sweeps the vendored trees for the classes of defect this migration has actually produced: repository-relative path literals that resolve to nothing, bare import specifiers no manifest declares, package scripts invoking a bin that `install` cannot create, cross-references to skills or wiki documents this repository does not have, broken skill links, and TypeScript no suite reads.

Expect one standing false positive: `@org/api`, a package name inside a fixture string. Most `path` hits are the benchmark describing the workspace it generates (`packages/api`, `packages/backend`) and are correct as written — rewriting those to this repository's layout would break the benchmark.
