---
name: contracts
description: Defines common and scoped Evidence acknowledgment contracts for maintained production code. Use before implementing or reviewing production declarations, and when changing evidence.config.json selection or checklist documents. Product behavior remains owned by project and package documentation; adoption procedures belong to development.
---

# Engineering Contracts

The common checklist applies to the production declarations selected by `evidence.config.json`. Read the scoped topics for the operations a change implements or affects, including private helpers. A package name alone does not make every scoped contract apply to every declaration in that package.

Apply contracts at the scope of the promise: common requirements across maintained production code, package requirements across the public behavior the package promises, and operation requirements across the implementations that establish them. These scopes accumulate. Splitting a package into logical units does not let a helper or adapter escape its package's contract.

Use the project skill and package documentation to identify package requirements. Split an acknowledgment topic when its implementations need different facts to establish correctness or cost, not simply because they occupy different directories. Keep one promise owned in one place, including when several packages implement it. Review the complete operation through its entry point and helpers; a passing tag on an entry point alone does not establish the operation's contract.

Each checklist section defines the facts an acknowledgment must address. Several related checks may share one section; review checks every requested fact because Evidence verifies the presence of a tag, not the truth or completeness of its prose.

Every common check requires an answer. Scoped questions beginning with a role such as boot, printing, or fix orchestration apply when the operation serves that role; describe its contribution to the contract without claiming it performs other operations in the topic.

Product rules remain owned by the linked package documentation, the project skill, and typescript-go-sync. These documents define acknowledgment questions for those rules. Development owns adoption and validation; review owns judgment of the implementation.

Each package's `evidence.config.json` owns its machine enrollment and resolves source paths from that package. Common and scoped checklist documents remain shared under this skill. References use `../../.agents/skills` as their root and paths such as `contracts/common.md` beneath it. Scoped documents guide applicable reviews now; add their checker claims only after public-host selection and applicability have been verified. Do not assign every scoped document to a whole package, add unused tags, or count a review-only topic as checker enforcement. Tests and benchmarks retain their existing adoption boundaries.

Verify a host answering all its applicable contracts in one run, including existing tags for other contracts. Address resolution and an isolated missing-answer report do not prove that overlapping claims accept the completed answers. When selection must be partitioned to accommodate the checker, preserve the original common obligations for every host and verify the combined reference population rather than shrinking the baseline to make the check pass.

## [Common Contracts](common.md)

Implementation shortcuts, supported-OS behavior, and useful documentation with documentation-skill compliance.

## [Work And Resource Costs](performance.md)

Input and request scaling, repeated work, retained resources, and evidence for performance changes in operations where these costs matter.

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
