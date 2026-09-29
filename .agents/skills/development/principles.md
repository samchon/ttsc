# Engineering Principles

These four principles govern the maintained production declarations selected by `evidence.json` and guide review of the private helpers those declarations use. Each H2 is one checklist obligation.

Keep this checklist limited to implementation shortcuts, supported-platform behavior, and documentation. Resource, state, and architecture checks belong to the [development workflow](workflow.md#review-conditions), where the operation or change determines their applicability. Requiring every data field to explain resource cleanup or package placement would repeat unrelated claims without examining those risks.

An acknowledgment records a concrete claim about the implementation. Reviewers check that claim against the code because a complete set of tags can still contain false statements.

The [development workflow](workflow.md#evidence-adoption) owns selection, commands, and acknowledgment procedures.

## No hard coding

Derive behavior from supported inputs and the owning contract. Do not special-case a consumer, fixture name, expected answer, or measured result, or add a branch whose sole purpose is passing a test or improving a measurement. Protocol constants, discriminants, and documented defaults may be fixed values when their contract owns them.

A special case can produce the expected result for a known input while leaving the same behavior wrong for other supported consumers. Test-only branches have the same defect: the passing result describes the setup rather than the product. These are one obligation because both require decisions justified by the supported contract.

Identify the input, configuration, or contract from which the declaration derives its decisions.

## No monkey patching

Use documented registration, extension, and dependency-injection boundaries. Do not replace another module's methods, globals, or internals to change its behavior.

Replacing foreign behavior makes correctness depend on initialization order and other callers sharing the same process. It also couples the implementation to internals that the dependency may change without preserving compatibility.

Identify the supported extension boundary or explain which owned state the declaration changes without mutating foreign behavior.

## Portable behavior

Shared logic must preserve its defined behavior on every supported OS. Account for path roots, separators, case behavior, line endings, and process invocation. Keep filesystem paths distinct from URLs, and use argument-vector process APIs for ordinary commands.

These differences can change which file a compiler reads or what command it executes. A path or command that works on one machine does not establish the same behavior on another OS.

Necessary native implementations belong behind an explicit platform boundary. Document the supported behavior and the corresponding implementation for each platform so the shared caller can rely on one defined contract.

Identify the portable mechanism, the absence of OS-sensitive operations, or the native boundary the declaration serves.

## Meaningful documentation

Every selected public declaration and public member carries native documentation explaining its purpose and the nonobvious conditions or invariants needed to use it correctly. State accepted inputs, output meaning, invalid or unsupported input behavior, side effects, units, defaults, and optional-state meaning where relevant. TypeScript uses JSDoc; Go uses declaration documentation comments.

Names and types cannot tell a caller who owns a resource, what an absent value means, or which state must hold before a call. Documentation must supply those facts so the caller does not have to infer the contract from the implementation.

Identify the actual facts explained by the documentation. The acknowledgment does not replace the explanation, and a comment that only repeats the declaration's name or type does not satisfy this principle.

Scoped requirements, such as benchmark roles and field units, remain additional obligations of their owning skill.
