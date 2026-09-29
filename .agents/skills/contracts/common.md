# Common Implementation Principles

Every selected type and function answers these questions for its actual responsibility. Properties retain native documentation and are reviewed through their owning type. Include helpers when assessing the operation that owns their behavior.

Give grounds a reviewer can check against the implementation and its supported contract. Keep straightforward decisions brief. Do not invent unrelated decisions, alternative implementations or development history to fill an answer. Evidence checks that acknowledgments exist; it does not establish their truth or replace tests.

## Principled Implementation

Implement the actual supported contract using methods justified by the problem's principles and constraints. Satisfy the obligations that interact at the declaration's boundary together. Silently weakening one to satisfy another changes the contract; an authorized product-contract change must be explicit.

Use established language idioms, documented APIs and supported extension points where they fit the requirement. Assess repository patterns and recognized algorithms against that requirement. Prior use or popularity alone does not establish suitability. A custom method must have a sound basis in the applicable contract or principles.

Explain the chosen method, why it is appropriate, the premises that make it applicable and any unresolved limitation. For algorithms and transformations, explain why the relevant preconditions hold for the supported inputs and representation, distinguishing authorized changes from meaning that must remain intact. A type explains why its representation fits its value contract.

Support nonobvious decisions with the actual contract, supported API, applicable algorithmic argument or authoritative reference. Address assumptions behind any proxy used to make a decision, and state approximation or validity limits where relevant. No declaration must invent a formal proof or cite a paper for an ordinary adapter.

## Clear and Simple Design

Use the simplest clear structure that fully satisfies the confirmed requirements. Make responsibility, dependencies and control flow apparent. Do not introduce unnecessary state, layers, configuration, abstractions or capabilities for presumed future requirements. Each additional element increases what callers and maintainers must understand.

Preserve required correctness, failure handling, performance, resource management and supported compatibility. Brevity and fewer files do not override those obligations. Keep changes local through appropriate responsibility boundaries rather than prebuilding speculative extension mechanisms.

Explain how the declaration's structure exposes its responsibility. Justify nonobvious layers, options or retained state by the actual requirement they serve. A clear type can explain its representation briefly without inventing an architecture.

## Prohibited Implementation Shortcuts

Do not substitute a shortcut for the implementation the product requires:

- **Hardcoding:** do not special-case consumers, fixtures, expected answers or measurement results. Contract-defined constants, discriminants and defaults remain legitimate.
- **Monkey patching:** do not replace foreign methods, globals or internals to change their behavior. Use supported extension or injection boundaries.
- **Test-only logic:** do not add production behavior solely to make a test or measurement pass. Correct the implementation against the real requirement.
- **Chains of workarounds:** when an assumption is disproven, correct the owning design instead of retaining it beneath compensating wrappers, retries or exceptions. Remove superseded compensations in the owning repair. A necessary compatibility path must preserve a supported requirement, not disguise the broken assumption.

These shortcuts can satisfy known examples while leaving the product dependent on foreign internals or a false premise. The answer explains the relevant decision or boundary that avoids them and identifies any unresolved violation. Do not repeat every prohibition where the declaration has no such decision.

Explain retained compatibility and recovery paths through the current supported contract they serve. [Development](../development/SKILL.md#repair-discipline) owns the repair procedure and [Review](../review/SKILL.md#review-law) verifies the before-and-after consequences. A permanent declaration acknowledgment need not reconstruct its development history. A passing test or renamed wrapper does not explain why a path is justified.

## Meaningful documentation

Write useful native documentation for public declarations and members. Explain purpose and the nonobvious facts needed to use them, such as ownership, units, failure effects or optional-state meaning. Repeating names, types and executable branches does not supply that context.

Follow the [documentation skill](../documentation/SKILL.md) in related repository documents and apply its paragraph separation, clear prose and explanation of reasons to native comments. Preserve TypeScript JSDoc and Go declaration-comment syntax. Concision does not justify forcing different ideas into one paragraph.

Separate descriptive prose from acknowledgment tags with a blank comment line. Separate documented properties with a blank source line so each explanation is visibly associated with its member. Properties retain useful native documentation without separate checklist acknowledgments.

The answer identifies the useful facts documented and the applicable documentation guidance followed, including repository documents changed. It checks the writing, not whether the skill works. The acknowledgment does not replace the documentation it describes.
