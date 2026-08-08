# Evidence Backend Review

Review the backend only: find and correct every fake `@evidence` and `@evidenceExclude`, especially tags added only to evade compiler errors, and every place the code contradicts a requirement it cites.

Read `.agents/skills/review/SKILL.md` and `.agents/skills/review/backend.md` before working, and follow them exactly.

## Final Checklist

- [ ] Every active backend `@evidence` and `@evidenceExclude`, its target, reason, and complete host inspected.
- [ ] Every fake `@evidence`, including any added only to evade compiler errors, corrected.
- [ ] Every cited requirement read and the host checked against it; each disagreement resolved in whichever is wrong — the code, the reason, or the target — never in the requirement.
- [ ] Every exclusion carrier read in full and every entry decided; each names its owner or alternative and invalidating condition, and every fake exclusion corrected.
- [ ] No exclusion stands in for an artifact this scope owes, and none sits on a working host instead of its carrier.
- [ ] Every backend claim is enabled and `evidence/todo` is `error`; no other rule or claim configuration changed and `evidence/graph` and `evidence/review` remained `error`.
- [ ] Backend `check:watch` completed a rebuild without diagnostics and remains running.
- [ ] `pnpm test` exits with code 0 after the last correction.

Any unchecked item leaves the Goal active. Complete that item.
