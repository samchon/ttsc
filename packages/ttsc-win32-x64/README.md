# `@ttsc/win32-x64`

Windows x64 native binaries and bundled Go compiler package for `ttsc`.

This package is normally installed as an optional dependency of `ttsc`. Application projects should install `ttsc`, not this package directly.

It contains the `ttsc` platform helper, the `ttscserver` LSP wrapper, the `ttscgraph` MCP code-graph server, and the Go SDK used when `ttsc` builds Go source plugins. If your package manager skipped optional dependencies, reinstall `ttsc` with optional dependencies enabled.

## Package contents

This package intentionally ships the prebuilt `win32-x64` artifacts for `ttsc`:

- `bin/ttsc.exe`: the native command helper.
- `bin/ttscserver.exe`: the native language-server wrapper.
- `bin/ttscgraph.exe`: the native MCP code-graph server (used by `@ttsc/graph`).
- `bin/go/`: a pruned Go SDK used to compile source plugins into cached plugin binaries.

Source and build entrypoint: [`packages/ttsc`](https://github.com/samchon/ttsc/tree/master/packages/ttsc) and [`scripts/build-platform-package.cjs`](https://github.com/samchon/ttsc/blob/master/scripts/build-platform-package.cjs).

There is no `postinstall` download step. Supply-chain scanners may report the native executables or bundled Go SDK as opaque or obfuscated because they are not readable JavaScript source. Review the npm package metadata when triaging that finding:

```bash
npm view "@ttsc/win32-x64@<version>" dist.integrity dist.signatures dist.attestations --json
npm pack "@ttsc/win32-x64@<version>" --dry-run --json
```
