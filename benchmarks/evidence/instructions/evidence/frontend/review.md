# Evidence Frontend Review

Review the frontend only: find and correct every fake `@evidence` and `@evidenceExclude`, especially tags added only to evade compiler errors, and every place the code contradicts a requirement it cites.

Read `.agents/skills/review/SKILL.md` and `.agents/skills/review/frontend.md` before working, and follow them exactly.

## Final Checklist

- [ ] Every active frontend `@evidence` and `@evidenceExclude`, its target, reason, and complete host inspected.
- [ ] Every fake `@evidence`, including any added only to evade compiler errors, corrected.
- [ ] Every cited requirement read and the host checked against it; each disagreement resolved in whichever is wrong — the code, the reason, or the target — never in the requirement.
- [ ] Every exclusion carrier read in full and every entry decided; each names its owner or alternative and invalidating condition, and every fake exclusion corrected.
- [ ] No exclusion stands in for an artifact this scope owes, and none sits on a working host instead of its carrier.
- [ ] Every backend carrier entry naming the frontend as owner checked against what this layer delivers, and every frontend entry deferring to the backend checked against the operation and test that carry it.
- [ ] Every frontend claim is enabled; no other claim configuration changed and `evidence/graph` and `evidence/review` remained `error`.
- [ ] All three configurations compared with the baseline, since no later scope reviews them.
- [ ] Both `pnpm dev` processes reported no diagnostics after the last file change.
- [ ] Live-backend `pnpm test:e2e` exits with code 0 after the last correction.

Any unchecked item leaves the Goal active. Complete that item.
