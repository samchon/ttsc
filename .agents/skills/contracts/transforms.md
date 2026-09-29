# Configured Transforms

Apply to the transform logic and configuration handling in `packages/banner/driver`, `packages/paths/driver`, and `packages/strip/driver`. These are distinct product effects, not three implementations of one semantics-preserving formatter.

The contracts are [banner](../../../packages/banner/README.md#configuration), [paths](../../../packages/paths/README.md#configuration), and [strip](../../../packages/strip/README.md#configuration). The [strip description](../../../packages/strip/README.md) also states the intentional removal of argument side effects.

## Perform only the configured product effect

Identify the owning transform and the configuration or compiler options that authorize its change. Explain the matched source shape and what remains untouched.

For banner, identify discovered text, missing-config behavior, and normal comment emit policy. For paths, identify alias resolution and the source-to-emitted-location mapping, including the absence of `outDir`. For strip, identify configured statement-level matches and the deliberate removal of the whole statement, including its arguments. Answer the transform this operation implements; do not require a strip helper to describe banner generation.

A blanket claim of preserved runtime semantics would be false for configured stripping. A broader match can remove unconfigured behavior, while a path rewrite based only on source locations can produce an import that does not name the emitted file.
