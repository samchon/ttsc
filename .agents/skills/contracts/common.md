# Common Implementation Principles

Every selected declaration answers these questions. Describe its actual responsibility; a data type does not need an invented algorithm or declarations that it performs no unrelated operations.

## Standard Implementation Practices

Use established language idioms, documented APIs, supported extension points and suitable repository patterns. Explain which approach fits the requirement and why any departure is necessary. Existing code is a reference to assess, not proof that its approach is suitable.

The answer identifies the chosen approach and its justification. Explain nonobvious departures and fixed decisions without restating every branch. For ports and adaptations, identify the authoritative specification or supported API that guides the implementation and explain any departure. A type explains why its representation fits the value contract.

## Prohibited Implementation Shortcuts

Do not substitute a shortcut for the implementation the product requires:

- **Hardcoding:** do not special-case consumers, fixtures, expected answers or measurement results. Contract-defined constants, discriminants and defaults remain legitimate.
- **Monkey patching:** do not replace foreign methods, globals or internals to change their behavior. Use supported extension or injection boundaries.
- **Test-only logic:** do not add production behavior solely to make a test or measurement pass. Correct the implementation against the real requirement.
- **Chains of workarounds:** when an assumption is disproven, correct the owning design instead of retaining it beneath compensating wrappers, retries or exceptions. Remove superseded compensations in the owning repair. A necessary compatibility path must preserve a supported requirement, not disguise the broken assumption.

These shortcuts can satisfy known examples while leaving the product dependent on foreign internals or a false premise. The answer explains the relevant decision or boundary that avoids them and identifies any unresolved violation. Do not repeat every prohibition where the declaration has no such decision.

For a repair, name the invalid assumption, the owning correction and the compensations removed or still justified. [Development](../development/SKILL.md#repair-discipline) owns the repair procedure; a passing test or renamed wrapper does not explain why the cause was corrected.

## Meaningful documentation

Write useful native documentation for public declarations and members. Explain purpose and the nonobvious facts needed to use them, such as ownership, units, failure effects or optional-state meaning. Repeating names, types and executable branches does not supply that context.

Follow the [documentation skill](../documentation/SKILL.md) in related repository documents and apply its paragraph separation, clear prose and explanation of reasons to native comments. Preserve TypeScript JSDoc and Go declaration-comment syntax. Concision does not justify forcing different ideas into one paragraph.

The answer identifies the useful facts documented and the applicable documentation guidance followed, including repository documents changed. It checks the writing, not whether the skill works. The acknowledgment does not replace the documentation it describes.
