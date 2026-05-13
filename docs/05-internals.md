# Internals: Build and Cache

This page is for debugging source plugin builds.

## Cold Build Path

When `ttsc` sees a plugin `source` descriptor:

1. Resolve `source`.
2. Hash the plugin source and host versions.
3. Reuse the cached binary on hit.
4. Copy source into a scratch directory on miss.
5. Generate a `go.work` overlay pointing at `ttsc` and its shims.
6. Run `go build -o plugin <entry>`.
7. Move the binary into the cache.
8. Invoke the binary with `check`, `transform`, or `build`.

## Cache Key Inputs

The cache key includes:

- `ttsc` package version.
- resolved `@typescript/native-preview` version.
- platform and architecture.
- resolved source entry.
- files under the plugin source directory, except skipped generated/cache directories and editor backup files ending in `~`.
- the same hashable files under the local `ttsc` and shim overlay directories used for the generated `go.work`.

The cache key does not include:

- consumer TypeScript source files;
- plugin options such as lint `rules` / `extends`, `banner`, or `calls`;
- CLI flags such as `--emit` or `--outDir`;

README, JSON, schema, and other data files inside the plugin source directory do affect the cache key. This keeps `//go:embed` and other file-backed plugin data aligned with the built binary. Local workspace changes to `ttsc`'s Go host or shim overlay also invalidate the source plugin cache automatically.

## Cache Locations

Default:

```text
<project>/node_modules/.ttsc/plugins/<key>/plugin
<project>/.ttsc/plugins/<key>/plugin
```

Override:

```bash
TTSC_CACHE_DIR=/tmp/ttsc-cache npx ttsc --emit
```

Clean:

```bash
npx ttsc clean
```

## Go Toolchain Resolution

`ttsc` resolves Go in this order:

1. `TTSC_GO_BINARY`, when set.
2. the installed `@ttsc/{platform}-{arch}` package's bundled Go SDK.
3. local workspace fallback under `ttsc/native/go`.
4. `go` on `PATH`.

Published consumer installs should use the bundled Go SDK. `go` on `PATH` is mainly a development fallback.

## Debugging Build Failures

If `go build` fails, `ttsc` prints the Go stderr:

```text
ttsc: building plugin "my-plugin" via "go build" failed:
go-plugin/main.go:42:8: undefined: shimast.Something
```

Check:

- missing shim `require` in `go.mod`;
- missing source files in the npm tarball;
- wrong source directory or package entry;
- stale cache, fixed with `npx ttsc clean`;
- pnpm local dev layout, fixed in [Local Development](./04-local-dev.md).

## Concurrency

Concurrent `ttsc` processes may build the same missing key at the same time. Scratch directories are unique, and the final move is atomic. This is wasteful but safe.
