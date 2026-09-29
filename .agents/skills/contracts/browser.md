# Browser Lifecycles And Packages

Apply to `packages/wasm/src/bootTtsc.ts`, snapshot ownership in `packages/wasm/host/fountain.go`, and playground Worker, npm-installation, and runtime-resolution operations. UI presentation does not inherit every boot and archive requirement.

The contracts are [WASM boot and cancellation](../../../packages/wasm/README.md#stamping-version-metadata-at-link-time), [snapshot ownership](../../../packages/wasm/README.md#fountain-api-snapshot-ast-type-checker), and [playground dependency installation](../../../packages/playground/README.md#runtime-npm-dependency-installer). Check the [boot implementation](../../../packages/wasm/src/bootTtsc.ts) for the distinction between retryable failure before `go.run` and terminal failure after it starts.

## Preserve the owned browser state

For boot, identify the shared-attempt key, cancellation reach, readiness ownership, and retry or Worker-replacement boundary. For snapshot operations, identify handle ownership and release. Do not promise independent cancellation to callers of one shared attempt.

For package installation, identify registry and exact-version identity, archive integrity and root/size validation, and how removed dependencies leave the mounted file maps. For runtime resolution, identify the package-exports boundary and active conditions. Installation limits and integrity checks do not make the CommonJS evaluator a security sandbox; identify the execution isolation supplied by the host when that is part of the operation.

A retry can collide with a Go runtime JavaScript cannot stop. An additive package update can also retain an obsolete graph, while a misleading sandbox claim can cause a host to run untrusted code with capabilities it did not intend to grant.
