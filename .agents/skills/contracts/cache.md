# Cache Reuse

Apply to generation keys, dependency declarations, snapshot validators, publication, and eviction. Relevant units include the compiler runtime cache, Unplugin's `core/transform/{cache,validation,generation,project}` logic, and Metro's `core/fingerprint.ts`. An adapter's option type or UI component does not establish cache validity.

The contracts are recorded in [generation key construction](../../../packages/unplugin/src/core/transform/cache/createTransformCacheKey.ts), [complete snapshot validation](../../../packages/unplugin/src/core/transform/validation/matchesCompleteInputSnapshot.ts), [transform dependency declarations](../../../packages/ttsc/driver/transform_dependencies.go), and [Metro invalidation](../../../packages/metro/README.md#cache-invalidation).

## Prove reuse of the same inputs

Identify the inputs and identity predicates this operation contributes to the reuse proof, including relevant compiler options, plugins, source content, configuration discovery, physical paths, directory membership, and external dependencies. Explain how missing, changed, volatile, or incompletely observed inputs affect reuse, and where failure withdraws a successful generation.

State the adapter-specific proof used. A build-scoped notification proof, complete snapshot validation on a hit, and Metro's static project fingerprint are different mechanisms; do not claim one as a substitute for another.

A delivered file can be unchanged while a referenced type, plugin configuration, symlink target, or project membership changes its output. An undeclared dependency set must not be described as complete merely because it is empty.
