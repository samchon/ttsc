# Evidence Evaluation

Apply to `packages/evidence/native/` operations that materialize units, resolve citations, judge coverage, or report analysis state. Rule option declarations have their own documentation obligations but do not each perform evaluation.

The authoritative invariants remain in [project/evidence](../project/evidence/SKILL.md), including [identity and hierarchy](../project/evidence/SKILL.md#units-and-hierarchy), [evaluation](../project/evidence/SKILL.md#evaluation), and [reference policies](../project/evidence/SKILL.md#reference-policies). The standalone adoption checker is a separate implementation; its adapter results cannot be used as proof that these invariants hold.

## Keep coverage attached to real identities

Identify the unit and host identities this operation consumes or produces, their explicit hierarchy, and the claim or reference whose policy it evaluates. Explain how failed loading, ambiguous resolution, unsupported syntax, or incomplete inventory remains visible rather than shrinking a coverage denominator silently.

Where applicable, explain exclusion scope, review pairing, and checklist ownership. A review is not evidence, one host's checklist answer is not another host's answer, and reference-local coverage must not pool across policies. Cite the owning invariant and the mechanism this operation uses; do not restate the entire engine contract on every helper.

An identity mistake can produce a passing graph by merging obligations or losing hosts. A partial inventory can likewise look like complete coverage when the missing denominator is hidden.
