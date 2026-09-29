# Compiler Shims

Apply to hand-maintained files and authored wrappers under `packages/ttsc/shim`. Generated declarations remain owned by their generator and excluded from handwritten acknowledgments.

The contract and verification procedure remain in [typescript-go-sync](../typescript-go-sync/SKILL.md), especially [shim structure](../typescript-go-sync/SKILL.md#shim-structure), [mechanical completeness](../typescript-go-sync/SKILL.md#mechanical-completeness-gate), and [traversal probes](../typescript-go-sync/SKILL.md#traversal-completeness-probes).

## Expose a usable upstream operation

Identify the pinned upstream symbol, exact signature, and approved alias, wrapper, or linkname mechanism. Explain the producer or caller-owned boundary from which a plugin obtains the compiler objects the operation consumes.

For traversal operations, identify the runtime reach the consumer needs; nameability and successful compilation alone do not establish that reach. Preserve generated versus hand-maintained ownership rather than modifying generated declarations for one consumer.

A public method whose receiver cannot be obtained is not a usable API. A compiling traversal can still stop before the node a plugin needs, so linkage is weaker evidence than runtime reach.
