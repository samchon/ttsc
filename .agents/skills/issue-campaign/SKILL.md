---
name: issue-campaign
description: "Defines the default solo repository-wide issue campaign for ttsc: exhaustive discovery, lead-vetted issue publication, one unified CI-validated implementation pull request per cycle, solo Self-Review, and repeated rediscovery until a full clean round. Use for broad audits, many issue candidates, or repeated issue-to-pull-request campaigns unless the user explicitly requests parallel or multi-agent execution; do not use for one already-defined issue or an ordinary pull request."
---

# Issue Campaign

An issue campaign is a repeatable solo sequence of exhaustive discovery, issue publication, one unified implementation pull request, and renewed discovery. The main agent owns every phase and spawns no subagent other than the read-only commit early-warning pass that [development.md](development.md#implement-and-write-tests) defines.

Use the [multi-agent skill](../multi-agent/SKILL.md) and its issue-campaign procedure instead only when the user explicitly asks for a parallel or multi-agent issue campaign.

The user's requested phase boundary controls how far to proceed. Do not infer permission to publish issues, push branches, open pull requests, or merge from an audit-only request.

Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every admission, disposition, implementation, and review decision.

Read the project and review skills before starting. Use the review skill's Solo Issue Discovery Rounds. Read [development.md](development.md) in full only when implementation is authorized.

## Campaign Knowledge Base

Create `.wiki/<campaign>/` with a short filesystem-safe campaign name. Preserve and reconcile an existing campaign directory.

Keep concise, current Markdown documents for:

- repository provenance, architecture, validation ownership, and product boundaries;
- experiments, reproductions, dogfooding, and related issue or pull-request history;
- every raw candidate, its evidence, dependencies, and final disposition;
- candidate combinations, splits, rejections, deferrals, and the evidence supporting each decision; and
- the published-issue DAG, internal implementation order, the unified cycle pull request, CI and Self-Review iterations, external blockers, campaign timing, and cleanup state.

Record raw candidates before fact-checking. The knowledge base is the durable place to collect overlapping observations, then combine, split, rewrite, reject, or defer them without losing why.

The knowledge base supports the campaign but is not the final issue body. A published issue must stand alone without access to `.wiki`.

## Discover Issues

Perform one complete Solo Issue Discovery Round over the entire declared campaign scope. Source is only one evidence layer. Exercise real workflows and inspect relevant upstream behavior, history, generated artifacts, consumers, fixtures, public documentation, and closed decisions.

Treat the development skill's [Forbidden](../development/SKILL.md#forbidden) section as a retrospective audit contract, not only a rule for future changes. In every complete round, inspect the implementation and history for a verified violation, even when existing tests pass. Prove the classification from purpose, control flow, consequence, and history. Resemblance or stylistic preference is not evidence.

Do not stop after finding enough work for a pull request. Complete the entire scope, adjudicate the full candidate pool, and publish only the surviving issues when authorized.

After the cycle pull request merges, begin a fresh full-scope round against the integrated repository. Earlier rounds are not coverage. The campaign ends only when a complete fresh round produces no meaningful issue candidate after fact-checking and no accepted issue remains unresolved.

## Vet And Publish Issues

The same main agent owns every publication decision. For each candidate:

1. Reopen its evidence and reproduce the behavior.
2. Verify ownership, provenance, and any claimed classification under the development skill's **Forbidden** section.
3. Trace the full consequence surface.
4. Compare open and closed issues and pull requests.
5. Record accept, partial acceptance, rewrite, combine, split, reject, or defer with the supporting evidence.

Publish only the adjudicated form and only with user authorization.

### Self-Contained Issue Body

Write enough context for a fresh AI agent to begin implementation from the issue alone. Do not require access to local `.wiki`, the discovery conversation, or unstated repository knowledge. Cover these sections when they apply:

- **Problem:** current and expected behavior, impact, and affected users.
- **Evidence:** exact reproduction, outputs or artifacts, stable symbols, verified root cause, ownership, and provenance. For a violation of the development skill's **Forbidden** section, prove the classification from behavior, control flow, and history instead of merely naming the prohibition. Line numbers are navigation, not proof.
- **Consequence surface:** affected consumers, states, platforms, compatibility and failure paths, plus the complete case matrix for the cause.
- **Approach:** the invariant and architectural owner, without prescribing an unverified implementation.
- **Acceptance and verification:** positive, negative, boundary, and regression outcomes with narrow and broader proving commands.
- **Coordination:** dependencies, exclusions, migration concerns, external blockers, and related open, closed, accepted, or rejected work.

Use tables for repeated case mappings. Read the rendered issue back and keep its body as the current operative handoff; use comments only for chronology.

## Develop And Repeat The Campaign

Read [development.md](development.md) in full when the user authorizes implementation pull requests or the end of a campaign that entered implementation. It owns the single cycle pull request, empty claim, internal DAG order, test authoring, formatting, ordinary CI, red-CI repair, solo Self-Review, merge, branch and temporary-asset cleanup, and renewed discovery.

An audit-only or issue-publication-only campaign does not load the development procedure or mutate repository or GitHub state beyond the authorized publications.
