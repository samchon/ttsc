# Cell Integrity

A cell's edits to its own workspace are the measurement; only edits its workspace instructions forbid void it. Your own limits are in [boundary.md](boundary.md) and never apply to a cell.

## Allowed Edits

The Evidence arm may, only when its workspace skills say so:

- delete a predeclared `disabled` property and its marking comment, layer by layer;
- raise `evidence/todo` from `off` to `error` in `packages/backend/test/lint.config.ts` once the operation tests exist;
- raise `evidence/review` from `off` to `error` in all three claim configurations during the layer Review.

Skipping one when due is a failure to advance. Either arm may add a dependency with an explicit version, not a `catalog:` entry. Plain has no allowed lint-configuration edit.

## Violations

Each supervision cycle, diff every cell against its prepared baseline at every nesting level:

- any change to a `tsconfig.json`, or creating or deleting one;
- any `lint.config.ts` difference beyond the allowed edits, including a changed claim, selector, or glob, a lowered severity, or `evidence/graph` below `error`;
- in any `package.json`, a changed `main`, `exports`, `publishConfig`, `name`, `scripts`, or existing dependency specifier, a new top-level `types`, or a new export subpath;
- any change to `pnpm-workspace.yaml`, `.node-version`, or the root `packageManager`.

These decide the evidence population, so a violation voids the measurement even when the build passes.

## Warning

On a confirmed violation, quote the diff in the report, then stop the cell, attach a warning with the README's `warn` command, and resume the same run. Never repair or restart the cell to erase it.

```json
{
  "decision": "fail",
  "rationale": "The cell narrowed the reference files glob in packages/backend/test/lint.config.ts.",
  "feedback": "Restore packages/backend/test/lint.config.ts to its committed baseline. Its lint configuration is not yours to change."
}
```

`feedback` names only the file and the state to restore. The runner rejects any mention of the benchmark, operator, auditor, verdict, supervision, reviewer, plugin, another or external agent, or an arm or mode.
