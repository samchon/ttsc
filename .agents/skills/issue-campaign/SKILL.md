---
name: issue-campaign
description: Runs ttsc's issue campaign, repeating full-scope discovery rounds until one comes back empty, publishing the vetted issues, and landing them in one CI-validated cycle pull request before the next cycle begins. Use for a broad audit, many issue candidates, or repeated issue-to-pull-request work; not for one already-defined issue.
---

# Issue Campaign

A campaign runs in cycles. A cycle records its **cycle baseline**, the integrated target-branch state it audits, and repeats **discovery rounds** against that baseline until one round comes back empty. It then publishes the accepted issues and lands all of them in one **cycle pull request**, whose merge starts the next cycle against the new baseline.

## Authority And Mode

- The user's requested phase boundary controls how far to go. An audit-only request does not permit publishing issues, pushing branches, opening pull requests, or merging.
- Inside the authorized phases the campaign is an unattended run under [AGENTS.md's **Unattended runs** rule](../../../AGENTS.md#attitude). The cleanup steps in [development.md](development.md#merge-and-clean-up) are the destructive actions the campaign already authorizes.
- Apply [AGENTS.md's **Choose the principled course** rule](../../../AGENTS.md#attitude) to every admission, disposition, implementation, and review decision.
- Read the project and review skills before starting.

## Campaign Knowledge Base

Create `.wiki/<campaign>/` with a short filesystem-safe campaign name. Preserve and reconcile an existing campaign directory.

Keep concise, current Markdown documents for:

- repository provenance, architecture, validation ownership, and product boundaries;
- experiments, reproductions, dogfooding, and related issue or pull-request history;
- every round's cycle baseline, every raw candidate, its evidence, dependencies, and final disposition;
- candidate combinations, splits, rejections, deferrals, and the evidence behind each decision; and
- each cycle's empty-round gate, published-issue DAG, implementation order, cycle pull request, CI and Self-Review iterations, external blockers, timing, and cleanup state.

The knowledge base is where overlapping observations are collected and then combined, split, rewritten, rejected, or deferred without losing why. It supports the campaign but is never the issue body: a published issue stands alone without access to `.wiki`.

## Discovery Rounds

A discovery round audits the entire declared scope against the cycle baseline under the [review law](../review/SKILL.md#review-law). A round is never partitioned by package, concern, validation lane, the areas an earlier round touched, or a slice of the scope.

1. Audit source, tests, documentation, CI, packaging, generated artifacts, platform behavior, upstream and downstream provenance, and open and closed issues and pull requests. Exercise real workflows; source is only one evidence layer.
2. Audit the implementation and its history against the development skill's [Forbidden](../development/SKILL.md#forbidden) section, even where tests pass. Prove a violation from purpose, control flow, consequence, and history; resemblance or stylistic preference is not evidence.
3. Record every raw candidate and its evidence in the knowledge base before judging it.
4. Vet the full candidate pool as the next section describes, then publish the surviving issues when publication is authorized.
5. If any meaningful candidate survived, add the accepted issues to the cycle ledger and start another complete round against the same cycle baseline. Finding enough work for a pull request is not a reason to stop, and rechecking earlier candidates does not replace a new round. There is no round limit.

Implementation stays closed until a complete round produces no meaningful candidate after fact-checking. That empty round freezes the cycle's accepted issue set. A change to the target branch before the implementation claim invalidates the gate and starts a new sequence of rounds against the new baseline.

## Vet And Publish Issues

Vet each candidate before publication:

1. Reopen its evidence and reproduce the behavior.
2. Verify ownership, provenance, and any claimed Forbidden classification.
3. Trace its full consequence surface.
4. Compare it with open and closed issues and pull requests.
5. Record accept, partial acceptance, rewrite, combine, split, reject, or defer, with the evidence, so a later round does not rediscover a rejected premise as new.

Publish only the adjudicated form, and only with user authorization.

### Self-Contained Issue Body

Write enough context for a fresh agent to begin implementation from the issue alone, without the local `.wiki`, the discovery conversation, or unstated repository knowledge. Cover these sections when they apply:

- **Problem:** current and expected behavior, impact, and affected users.
- **Evidence:** exact reproduction, outputs or artifacts, stable symbols, verified root cause, ownership, and provenance. For a Forbidden violation, prove the classification from behavior, control flow, and history instead of naming the prohibition. Line numbers are navigation, not proof.
- **Consequence surface:** affected consumers, states, platforms, compatibility and failure paths, and the complete case matrix for the cause.
- **Approach:** the invariant and its architectural owner, without prescribing an unverified implementation.
- **Acceptance and verification:** positive, negative, boundary, and regression outcomes with narrow and broader proving commands.
- **Coordination:** dependencies, exclusions, migration concerns, external blockers, and related open, closed, accepted, or rejected work.

Use tables for repeated case mappings. Read the rendered issue back and keep its body as the current operative handoff; use comments only for chronology.

## Development

When the user authorizes implementation, read [development.md](development.md) in full. It owns the claim, implementation order, tests, formatting, CI, Self-Review, repair, merge, and cleanup of the cycle pull request, and no development action starts before the empty-round gate passes. An audit-only or publication-only campaign never loads it and changes no repository or GitHub state beyond the authorized publications.

## Completion

After each merge, the next cycle records the new baseline and returns to discovery rounds. The campaign is complete only when all of these hold:

- a complete round against the latest cycle baseline produces no meaningful candidate;
- no accepted or published campaign issue remains unresolved;
- no campaign pull request, branch, process, or assignment-owned temporary asset remains; and
- the target checkout is clean and synchronized.

An empty round with accepted issues still open ends only discovery. If an external blocker makes the conditions impossible, report the campaign as blocked, not complete.
