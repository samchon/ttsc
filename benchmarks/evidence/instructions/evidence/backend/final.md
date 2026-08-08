# Evidence Backend Final

Confirm every backend claim remains enabled. Do not edit `lint.config.ts` or lower `evidence/graph` or `evidence/review` from `error`.

Use the backend `pnpm check:watch` process kept running by Backend Start. Fix every diagnostic and wait for a rebuild without diagnostics. Keep it running.

Backend Review left `pnpm test` passing, and a Final correction is usually a tag, not a behavior. Rerunning it is your call: the watcher reports type and lint diagnostics only, so run it when a correction actually touched behavior, and fix every failure.

## Final Checklist

- [ ] Every backend claim remained enabled and `evidence/todo` remained `error`; `lint.config.ts` otherwise remained unchanged and `evidence/graph` and `evidence/review` remained `error`.
- [ ] After the last backend file change, `check:watch` completed a rebuild without diagnostics.
- [ ] Backend `check:watch` remains running.

Any unchecked item leaves the Goal active. Complete that item.
