# Engineering Principles

These principles govern the maintained production declarations selected by the repository's `evidence.json`. Each H2 is one checklist obligation. They also guide implementation and whole-surface review of the private helpers those declarations use. A tag records a checkable claim about the code; reviewers judge whether it is true. The [development workflow](workflow.md#evidence-adoption) owns selection, commands, adoption, and acknowledgment procedures.

## No hard coding

Derive behavior from supported inputs and the owning contract. Do not special-case a consumer, fixture name, expected answer, or measured result to make output match. Protocol constants and documented defaults may be fixed values when their contract owns them. Identify the input, configuration, or contract from which the declaration derives its decisions.

## No monkey patching

Use documented registration, extension, and dependency-injection boundaries. Do not replace another module's methods, globals, or internals to change its behavior. Identify the supported extension boundary or explain which owned state the declaration changes without mutating foreign behavior.

## No test-only logic

Implement behavior for real supported consumers. A branch whose sole purpose is satisfying one test or improving one measurement violates this principle even when the check passes. Identify the runtime contract the declaration implements and the supported inputs to which it applies.

## Portable behavior

Shared logic must preserve its defined behavior on every supported OS. Do not assume POSIX shell syntax, separator spelling, drive or root shape, case behavior, line endings, or platform-only process APIs. Keep filesystem paths distinct from URLs, and use argument-vector process APIs for ordinary commands. Necessary native implementations belong behind an explicit platform boundary; document the supported behavior and the corresponding implementation for each platform. Identify the portable mechanism, the absence of OS-sensitive operations, or the native boundary the declaration serves.

## Explicit contract

Define accepted inputs, output meaning, and invalid or unsupported input behavior. Describe observable side effects and compatibility conditions where they apply. Preserve the owning product's specified behavior rather than inventing coercion, fallback success, or stricter input rules. Identify the contract enforced by the declaration and how its relevant boundaries behave.

## Resource ownership

Release resources the declaration owns on success, failure, and cancellation, and preserve resources owned by its caller or another operation. For files, child processes, listeners, locks, and cache publications, identify the owner, lifetime, cleanup, and publication boundary. A declaration that acquires, transfers, or releases no resources may exclude this item with that concrete explanation.

## State consistency

Keep mutable state coherent across repeated calls, concurrent work, failure, cancellation, and recovery. A failed or incomplete operation must not publish partial success or preserve a stale successful result as current. Cache identity and invalidation must include the inputs that determine the result. Identify the state invariant and its protection; a declaration with no mutable state or state transitions may exclude this item with that explanation.

## Single source of truth

Give each rule, configuration value, and piece of state one authoritative owner, and reuse it through the appropriate boundary. Do not maintain independent copies of the same knowledge. Keep an abstraction tied to the current contract instead of building speculative machinery to answer the checklist. Identify the declaration's authoritative input or the shared owner it uses.

## Package responsibility

Implement behavior in the package and layer that owns it. Use supported cross-package seams, and keep downstream-specific rules out of the general compiler host. Identify the declaration's owner and any boundary it crosses. Product-specific invariants remain owned by the [project skill](../project/SKILL.md).

## Meaningful documentation

Every selected public declaration and public member carries native documentation explaining its purpose and the nonobvious conditions or invariants needed to use it correctly. State inputs, side effects, failure behavior, units, defaults, and optional-state meaning where relevant. TypeScript uses JSDoc; Go uses declaration documentation comments. An acknowledgment identifies the actual facts explained by that documentation and does not replace them. A comment that only repeats the declaration's name or type does not satisfy this principle. Scoped requirements, such as benchmark roles and field units, remain additional obligations of their owning skill.
