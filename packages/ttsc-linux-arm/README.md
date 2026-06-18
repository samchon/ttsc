# `@ttsc/linux-arm`

Linux arm native binaries and bundled Go compiler package for `ttsc`.

This package is normally installed as an optional dependency of `ttsc`. Application projects should install `ttsc`, not this package directly.

It contains the `ttsc` platform helper, the `ttscserver` LSP wrapper, and the Go SDK used when `ttsc` builds Go source plugins. If your package manager skipped optional dependencies, reinstall `ttsc` with optional dependencies enabled.

## Package contents

This package intentionally ships the prebuilt `linux-arm` artifacts for `ttsc`:

- `bin/ttsc`: the native command helper.
- `bin/ttscserver`: the native language-server wrapper.
- `bin/go/`: a pruned Go SDK used to compile source plugins into cached plugin binaries.

Source and build entrypoint: [`packages/ttsc`](https://github.com/samchon/ttsc/tree/master/packages/ttsc) and [`scripts/build-platform-package.cjs`](https://github.com/samchon/ttsc/blob/master/scripts/build-platform-package.cjs).

There is no `postinstall` download step. Supply-chain scanners may report the native executables or bundled Go SDK as opaque or obfuscated because they are not readable JavaScript source. Review the npm package metadata when triaging that finding:

```bash
npm view "@ttsc/linux-arm@<version>" dist.integrity dist.signatures dist.attestations --json
npm pack "@ttsc/linux-arm@<version>" --dry-run --json
```
