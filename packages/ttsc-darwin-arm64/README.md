# `@ttsc/darwin-arm64`

macOS arm64 native binaries and bundled Go compiler package for `ttsc`.

This package is normally installed as an optional dependency of `ttsc`. Application projects should install `ttsc`, not this package directly.

It contains the `ttsc` platform helper, the `ttscserver` LSP wrapper, and the Go SDK used when `ttsc` builds Go source plugins. If your package manager skipped optional dependencies, reinstall `ttsc` with optional dependencies enabled.
