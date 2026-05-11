# `@ttsc/linux-arm`

Linux arm (32-bit) native binary and bundled Go compiler package for `ttsc`.

This package is normally installed as an optional dependency of `ttsc`. Application projects should install `ttsc`, not this package directly.

It contains the platform helper and Go SDK used when `ttsc` builds Go source plugins. If your package manager skipped optional dependencies, reinstall `ttsc` with optional dependencies enabled.

## Tier 3 support

`linux-arm` (32-bit) is currently **published but not smoke-tested**. The `experimental.yml` install / unplugin / typia smoke matrices cover Linux x64, Linux arm64, macOS x64, macOS arm64, Windows x64, and Windows arm64; 32-bit Linux arm is excluded due to runner availability. Issues specific to this platform may take longer to surface and fix. Use the 64-bit `@ttsc/linux-arm64` package when possible.
