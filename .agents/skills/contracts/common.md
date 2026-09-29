# Common Engineering Contracts

These contracts govern the maintained production declarations selected by `evidence.json` and guide review of their private helpers. Each H2 is one checklist obligation. Its acknowledgment addresses every requirement in that section, even when several requirements share one tag.

Write concrete facts about the declaration. A simple data member can describe its contract and lack of runtime operations briefly; a filesystem or process operation needs its actual mechanisms explained. A generic statement such as "all principles are satisfied" gives a reviewer nothing to verify.

The [development workflow](../development/SKILL.md#evidence-adoption) owns selection, commands, and adoption. Evidence checks that acknowledgments exist; [review](../review/SKILL.md#review-law) checks that their facts are true and their answers cover the section.

## No implementation shortcuts

Implement behavior for supported consumers through the owning contract:

- **No hard coding:** do not special-case a consumer, fixture name, expected answer, or measured result. Protocol constants, discriminants, and documented defaults are legitimate fixed values when the contract defines them.
- **No monkey patching:** use supported registration, extension, and dependency-injection boundaries. Do not replace another module's methods, globals, or internals to change its behavior.
- **No test-only logic:** do not add a branch whose sole purpose is satisfying a test or improving a measurement.
- **No chains of workarounds:** when evidence disproves a design assumption, correct that assumption at the layer that owns the behavior. Do not keep the broken path and compensate for it with another fallback, wrapper, retry, or special case. An adapter or compatibility path is legitimate when an actual supported contract requires it and its boundary and behavior are explicit.

Hard-coded answers and test-only branches can make a known case pass while leaving the supported behavior wrong. Replacing foreign behavior makes correctness depend on initialization order and dependency internals. These prohibitions share an acknowledgment because they ask whether the implementation serves the real contract through an owned or supported mechanism.

Compensating for a failed assumption leaves the original defect active and makes later callers depend on the compensation. Another passing example does not establish that the owning behavior was repaired. The [repair procedure](../development/SKILL.md#repair-discipline) governs collecting symptoms and correcting their whole cause.

Identify the source of decisions and fixed values, the extension or mutation boundary, and the real consumer behavior served by the declaration. Address these prohibitions. For a data-only declaration, explain what its fields or literal values represent and that it introduces no executable branches or mutation.

For a repair, also identify the observed failure, the disproven assumption or other root cause, and the owning path corrected. Explain which superseded compensations were removed and why any remaining adapter, fallback, or retry belongs to a supported contract. Point to verification of the repaired behavior and relevant negative or boundary cases. Report an unverified cause as unresolved rather than claiming a workaround fixed it. Record these facts in the acknowledgment of the operation responsible for the repair and in its change review; subordinate helpers describe their contribution without repeating the whole history.

## Portable behavior

Shared logic must preserve its defined behavior on every supported OS. Account for path roots, separators, case behavior, line endings, and process invocation. Keep filesystem paths distinct from URLs, and use argument-vector process APIs for ordinary commands.

These differences can change which file a compiler reads or what command it executes. A successful run on one OS does not establish the same behavior on another.

Necessary native implementations belong behind an explicit platform boundary. Document the supported behavior and the corresponding implementation for each platform so the shared caller can rely on one defined contract.

Name the OS-sensitive operations and how their differences are handled. For a native implementation, name its platform boundary and the behavior used on other supported platforms. For a declaration without OS-sensitive behavior, explain that fact from its data contract or operations. "Works cross-platform" alone identifies no mechanism a reviewer can inspect.

## Meaningful documentation

Every selected public declaration and public member carries native documentation explaining its purpose and the nonobvious conditions or invariants needed to use it correctly. State accepted inputs, output meaning, invalid or unsupported input behavior, side effects, units, defaults, and optional-state meaning where relevant. TypeScript uses JSDoc; Go uses declaration documentation comments.

Names and types cannot tell a caller who owns a resource, what an absent value means, or which state must hold before a call. Documentation supplies those facts so the caller does not have to infer the contract from the implementation. A comment that repeats the declaration's name or type is insufficient.

Follow the [documentation skill](../documentation/SKILL.md) for repository documentation changed with the implementation, using its topic for the document being edited. Apply its clear prose, paragraph separation, and explanation of reasons to native comments too, while preserving the language's comment syntax and source-formatting conventions. Separate distinct ideas into paragraphs; brevity does not justify omitting context or cramming different requirements into one paragraph.

Identify the useful facts the native documentation explains and how the applicable documentation guidance was followed. If related repository documentation changed, identify that document and the guidance applied to it as well. The acknowledgment records the check; it does not replace the documentation. "Documented" or "documentation skill followed" alone does not establish what was checked.

Scoped requirements, such as benchmark roles and field units, remain additional obligations of their owning skill.
