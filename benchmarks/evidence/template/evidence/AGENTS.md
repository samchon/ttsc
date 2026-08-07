# AGENTS.md

<!-- benchmark-template-splice: base-body -->
{{base}}

### Evidence Graph

`.agents/skills/evidence/SKILL.md` defines the configured claims, activation, truthful behavioral proof, tag placement, exclusions, and compiler gates; its `backend.md` and `frontend.md` carry the per-phase configuration and unlock procedures. Read it for Evidence implementation and before handling a graph diagnostic.

### Evidence Review

`.agents/skills/review/SKILL.md` defines the review of `@evidence`, `@evidenceExclude`, their hosts, and the frozen graph configuration; its `backend.md` and `frontend.md` carry the per-scope configuration and gates. Read it only for a Backend or Frontend Review objective.
