# `@ttsc/graph-linux-arm64`

Linux arm64 native `ttscgraph` binary for `@ttsc/graph`.

This package is normally installed as an optional dependency of `@ttsc/graph`. Application projects should install `@ttsc/graph`, not this package directly.

It contains the native producer that `@ttsc/graph` spawns to build the checker-backed code graph for its MCP server, `dump` command, viewer and loader. The `ttsc` platform packages do not carry it, so a project without `@ttsc/graph` downloads none of it. If your package manager skipped optional dependencies, reinstall `@ttsc/graph` with optional dependencies enabled, or set `TTSC_GRAPH_BINARY` to an absolute path.

## Package contents

This package intentionally ships the prebuilt `linux-arm64` artifact for `@ttsc/graph`:

- `bin/ttscgraph`: the native graph producer for projects on TypeScript 7.0.
- `bin/ttscgraph-7.1`: the native graph producer for projects on TypeScript 7.1.

Source and build entrypoint: [`packages/ttsc/cmd/ttscgraph`](https://github.com/samchon/ttsc/tree/master/packages/ttsc/cmd/ttscgraph) and [`packages/ttsc/build/platform-package.cjs`](https://github.com/samchon/ttsc/blob/master/packages/ttsc/build/platform-package.cjs).

There is no `postinstall` download step. Supply-chain scanners may report the native executable as opaque or obfuscated because it is not readable JavaScript source. Review the npm package metadata when triaging that finding:

```bash
npm view "@ttsc/graph-linux-arm64@<version>" dist.integrity dist.signatures dist.attestations --json
npm pack "@ttsc/graph-linux-arm64@<version>" --dry-run --json
```
