# Common Engineering Contracts

These contracts govern the maintained production declarations selected by `evidence.config.json` and guide review of their private helpers. Each H2 is one checklist obligation. Its acknowledgment addresses every requirement in that section, even when several requirements share one tag.

Write concrete facts about the declaration. A data-only type can describe its fields' contract and lack of runtime operations briefly; a filesystem or process operation needs its actual mechanisms explained. A generic statement such as "all principles are satisfied" gives a reviewer nothing to verify.

The [development workflow](../development/SKILL.md#evidence-adoption) owns selection, commands, and adoption. Evidence checks that acknowledgments exist; [review](../review/SKILL.md#review-law) checks that their facts are true and their answers cover the section.

## Standard Implementation Practices

Use the language's established idioms, the library's documented APIs and supported extension points, and the repository's established implementation patterns when they satisfy the owning contract. Before introducing another mechanism, examine the applicable API and a maintained implementation of the same concern. Existing code is a reference to assess, not proof that its approach is correct.

When a different approach is necessary, identify the supported requirement the established approach cannot satisfy and explain why the chosen mechanism meets it. A familiar pattern or a passing test alone does not justify the choice. State the actual API or convention used; "standard implementation" is not an acknowledgment a reviewer can verify.

When translating or reimplementing behavior owned by another tool, identify its authoritative contract and explain why a separate implementation is necessary. The behavioral correctness question below owns verification through the actual consuming operation; a help command, preliminary parser or simplified local model can differ from that operation.

Supported boundaries give consumers defined behavior and let dependency maintainers change their internals without breaking the integration. Reusing a suitable established mechanism also avoids competing implementations with different validation, lifecycle or failure behavior.

Implement behavior for supported consumers through the owning contract:

- **No hard coding:** do not special-case a consumer, fixture name, expected answer, or measured result. Protocol constants, discriminants, and documented defaults are legitimate fixed values when the contract defines them.
- **No monkey patching:** use supported registration, extension, and dependency-injection boundaries. Do not replace another module's methods, globals, or internals to change its behavior.
- **No test-only logic:** do not add a branch whose sole purpose is satisfying a test or improving a measurement.
- **No chains of workarounds:** when evidence disproves a design assumption, correct that assumption at the layer that owns the behavior. Do not keep the broken path and compensate for it with another fallback, wrapper, retry, or special case. An adapter or compatibility path is legitimate when an actual supported contract requires it and its boundary and behavior are explicit.

Hard-coded answers and test-only branches can make a known case pass while leaving the supported behavior wrong. Replacing foreign behavior makes correctness depend on initialization order and dependency internals. These prohibitions share an acknowledgment because they ask whether the implementation serves the real contract through an owned or supported mechanism.

Compensating for a failed assumption leaves the original defect active and makes later callers depend on the compensation. Another passing example does not establish that the owning behavior was repaired. The [repair procedure](../development/SKILL.md#repair-discipline) governs collecting symptoms and correcting their whole cause.

Identify the established API, idiom or implementation pattern used, the source of decisions and fixed values, the extension or mutation boundary, and the real consumer behavior served by the declaration. Explain any necessary departure and address the prohibitions above. For a data-only type, explain the supported value contract its fields represent and that it introduces no executable branches or mutation; it does not need an invented algorithm or exception rationale.

For a repair, also identify the observed failure, the disproven assumption or other root cause, and the owning path corrected. Explain which superseded compensations were removed and why any remaining adapter, fallback, or retry belongs to a supported contract. Point to verification of the repaired behavior and relevant negative or boundary cases. Report an unverified cause as unresolved rather than claiming a workaround fixed it. Record these facts in the acknowledgment of the operation responsible for the repair and in its change review; subordinate helpers describe their contribution without repeating the whole history.

## Behavioral Correctness

Identify the behavior promised by the owning product documentation or protocol and explain how this declaration establishes it. For an operation, address the relevant accepted, rejected, boundary and failure cases, including observable state changes and side effects. For a type, explain the valid values, optional states and invariants, and identify the operation responsible for enforcing constraints that the type cannot enforce.

A documented API and an established implementation pattern can still produce the wrong result. Review the result against the owning contract through the actual consumer; an implementation's own output is not its correctness oracle. Identify the existing checks, a reproduction, or the inspected branches that support the acknowledgment, and distinguish observed results from behavior not exercised.

Describe intentional changes such as statement stripping according to their configured effect. Do not claim semantics preservation for an operation whose contract deliberately removes behavior. When adapting another tool, the authoritative consuming operation remains the source of expected results.

Report a verified defect or unresolved limitation explicitly and follow the authorized repair scope. An acknowledgment is a review record, not a certification that every requirement already passes. If repairs are deferred, identify the finding and affected behavior rather than claiming it was corrected or weakening selection to hide it. Evidence can accept a tag describing an unresolved defect; its successful exit does not discharge that defect.

This question is independent of implementation practices and documentation: it asks whether the supported behavior is established, rather than whether the mechanism is conventional or its description is useful. Reuse a concrete proof when it establishes several declarations' contributions; do not invent a new test or repeat the whole operation's proof on every helper.

## Meaningful documentation

Every selected public declaration and public member carries native documentation explaining its purpose and the nonobvious conditions or invariants needed to use it correctly. State accepted inputs, output meaning, invalid or unsupported input behavior, side effects, units, defaults, and optional-state meaning where relevant. TypeScript uses JSDoc; Go uses declaration documentation comments.

Names and types cannot tell a caller who owns a resource, what an absent value means, or which state must hold before a call. Documentation supplies those facts so the caller does not have to infer the contract from the implementation. A comment that repeats the declaration's name or type is insufficient.

Follow the [documentation skill](../documentation/SKILL.md) for repository documentation changed with the implementation, using its topic for the document being edited. Apply its clear prose, paragraph separation, and explanation of reasons to native comments too, while preserving the language's comment syntax and source-formatting conventions. Separate distinct ideas into paragraphs; brevity does not justify omitting context or cramming different requirements into one paragraph.

Identify the useful facts the native documentation explains and how the applicable documentation guidance was followed. If related repository documentation changed, identify that document and the guidance applied to it as well. The acknowledgment records the check; it does not replace the documentation. "Documented" or "documentation skill followed" alone does not establish what was checked.

Scoped requirements, such as benchmark roles and field units, remain additional obligations of their owning skill.
