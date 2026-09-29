---
name: contracts
description: Defines common and scoped Evidence acknowledgment contracts for maintained production code. Use before implementing or reviewing production declarations, and when changing evidence.json selection or checklist documents. Product behavior remains owned by project and package documentation; adoption procedures belong to development.
---

# Engineering Contracts

The common checklist applies to the production declarations selected by `evidence.json`. Read the scoped topics for the operations a change implements or affects, including private helpers. A package name alone does not make every scoped contract apply to every declaration in that package.

Each checklist section defines the facts an acknowledgment must address. Several related checks may share one section; review checks every requested fact because Evidence verifies the presence of a tag, not the truth or completeness of its prose.

Every common check requires an answer. Scoped questions beginning with a role such as boot, printing, or fix orchestration apply when the operation serves that role; describe its contribution to the contract without claiming it performs other operations in the topic.

Product rules remain owned by the linked package documentation, the project skill, and typescript-go-sync. These documents define acknowledgment questions for those rules. Development owns adoption and validation; review owns judgment of the implementation.

The root JSON configuration owns machine enrollment. Scoped documents guide applicable reviews now; add their checker claims only after public-host selection and applicability have been verified. Do not assign every scoped document to a whole package, add unused tags, or count a review-only topic as checker enforcement. Tests and benchmarks retain their existing adoption boundaries.

## [Common Contracts](common.md)

Implementation shortcuts, supported-OS behavior, and useful documentation with documentation-skill compliance.

## [Checked Execution](execution.md)

Compiler and runtime paths that prepare, check, load, and execute TypeScript.

## [Cache Reuse](cache.md)

Transform generations, input proofs, and adapter-specific invalidation in the compiler, Unplugin, and Metro.

## [Source Coordinates](coordinates.md)

Source maps, compiler byte offsets, and editor positions at the boundaries that translate them.

## [Source And Editor Edits](editing.md)

Lint fix orchestration, formatting, and application of command edits in the editor.

## [Evidence Evaluation](evidence.md)

Evidence inventory, identity, references, coverage, exclusions, and incomplete analysis.

## [Graph Facts](graph.md)

Compiler-derived facts, plugin artifact provenance, and graph snapshot publication.

## [Browser Lifecycles And Packages](browser.md)

WASM boot and snapshot ownership, Worker recovery, and playground dependency installation and evaluation.

## [AST Printing](printing.md)

Factory builders, printer layout, and synthetic comments.

## [Configured Transforms](transforms.md)

The distinct configured effects of banner, paths, and strip transforms.

## [Compiler Shims](shims.md)

Hand-maintained bridges to the pinned TypeScript-Go API and their usable producer paths.
