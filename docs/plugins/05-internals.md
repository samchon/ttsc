# Internals: Build & Cache

This page is for plugin authors debugging unexpected behavior — *why won't my plugin rebuild after I edited it?*, *where does the binary actually live?*, *what does ttsc do on a cold cache?* You don't need any of this to write a plugin, but it's the first place to look when something feels wrong.

## The build pipeline, end to end

When `ttsc` encounters a plugin with `native.source` in `compilerOptions.plugins`:

1. **Resolve the source dir.** Absolute paths are taken as-is; relative paths are resolved against the consumer's `tsconfig.json` directory.
2. **Hash the inputs.** The cache key is a SHA-256 over:
   - `ttsc` package version
   - resolved `@typescript/native-preview` (`tsgo`) version
   - `process.platform` / `process.arch`
   - `entry` value (default `.`)
   - every `*.go`, `*.s`, `*.c`, `*.h`, `*.cpp`, `*.hpp`, `go.mod`, `go.sum`, `go.work` file under the source dir, with relative path and content
   - no user options: `rules`, `--emit`, `--outDir`, `--plugins-json`, and other runtime flags are passed to the already-built binary and never invalidate the binary cache
3. **Cache hit?** If `<cache>/<key>/plugin` exists, use it. Skip everything below.
4. **Cache miss.** Create a per-process scratch dir at `<cache>/scratch-<key>-<pid>-<timestamp>/`. Copy the plugin source into it (excluding `node_modules`, `.git`, `dist`, `build`, `vendor`, `lib`).
5. **Write `go.work`** in the scratch dir. The `use` list contains:
   - `.` (the plugin scratch root)
   - the `ttsc` package itself (so its pinned indirect deps anchor the module graph)
   - every shim module under `<ttsc-package>/shim/`
6. **Run `go build -o plugin <entry>`** in the scratch dir.
7. **Move** `scratch/plugin` → `<cache>/<key>/plugin` via `fs.renameSync` (atomic on the same filesystem).
8. **Clean up** the scratch dir.
9. **Spawn** the cached binary with the appropriate subcommand (`build` / `transform` / `check`).

Every step is synchronous, single-threaded inside one `ttsc` process. Multiple `ttsc` processes may run concurrently — each gets its own pid-tagged scratch dir, and the final atomic rename converges on a bit-identical binary.

## Cache layout

```
<project>/node_modules/.ttsc/plugins/       # default when node_modules exists
├── <key-1>/
│   └── plugin                              # cached binary (or plugin.exe on Windows)
├── <key-2>/
│   └── plugin
└── ...
```

If the project does not have `node_modules/`, `ttsc` uses `<project>/.ttsc/plugins/` instead.

There is one binary per cache key. Scratch dirs are deleted after each successful build — if you see `scratch-*` directories left behind, a build crashed mid-flight.

### Where the cache lives

Default projects use local cache paths only:

1. `<project>/node_modules/.ttsc/plugins/` when `node_modules/` exists
2. `<project>/.ttsc/plugins/` when `node_modules/` does not exist

`TTSC_CACHE_DIR` is an explicit override for isolated tests and debugging; when it is set, `ttsc` uses `$TTSC_CACHE_DIR/plugins/`.

To force a full rebuild in normal use, run:

```bash
npx ttsc clean
```

That removes `node_modules/.ttsc/` and `.ttsc/` from the project root. In isolated tests, point `TTSC_CACHE_DIR` at a fresh temp directory or run `npx ttsc clean` with the same `TTSC_CACHE_DIR` value.

### What invalidates the cache

| Change | Triggers rebuild? |
| --- | --- |
| Edit a `.go` file in your plugin source | ✓ |
| Edit `go.mod` / `go.sum` / `go.work` | ✓ |
| Add or remove any tracked file | ✓ |
| Change `native.source.entry` | ✓ |
| Bump `ttsc` version (any `package.json` change) | ✓ |
| Bump `@typescript/native-preview` in the consumer | ✓ |
| Switch platforms (cross-machine cache reuse) | ✓ |
| Edit a `README.md` or other non-source file in the plugin dir | ✗ |
| Change plugin options such as `rules`, `mode`, or custom config fields | ✗ |
| Change CLI flags such as `--emit`, `--noEmit`, or `--outDir` | ✗ |
| Edit consumer's TypeScript source | ✗ (only the plugin's source affects the cache) |

## Go toolchain

`ttsc` invokes `go build` directly, but published `ttsc` installs should not
require a system Go installation. The platform-specific `@ttsc/*` optional
package carries a bundled Go SDK under `bin/go/`, and source plugins use that
compiler by default.

Toolchain resolution order:

1. `TTSC_GO_BINARY` env var if set (must be an absolute path)
2. `@ttsc/{platform}-{arch}/bin/go/bin/go{.exe}` from the installed optional dependency
3. `ttsc/native/go/bin/go{.exe}` for local workspace builds
4. `go` on `PATH` as a development fallback

The compiled plugin binary is still cached under the normal plugin cache:

```
<project>/node_modules/.ttsc/plugins/<cache-key>/plugin
<project>/.ttsc/plugins/<cache-key>/plugin
$TTSC_CACHE_DIR/plugins/<cache-key>/plugin   # explicit override only
```

Run `npx ttsc clean` to force plugin binary rebuilds during development.

If no compiler can be found, `ttsc` exits with:

```
ttsc: building plugin "..." failed because the Go toolchain was not found.
Reinstall ttsc with optional dependencies so the bundled Go compiler is present,
or set TTSC_GO_BINARY to an absolute path.
```

## Debugging a failing build

When a `go build` fails inside `ttsc`, the underlying `go` command's stderr is included verbatim:

```
ttsc: building plugin "my-plugin" via "go build" failed:
go-plugin/main.go:42:8: undefined: shimast.SomethingThatDoesNotExist
```

Things to check:

- **Did you forget the require line?** `no required module provides package github.com/microsoft/typescript-go/shim/...` → see [tsgo.md](./03-tsgo.md#how-to-use-a-shim--the-current-rules).
- **Is your source actually in the cache key?** Files matching `*.go`, `*.s`, `*.c`, `*.h`, `*.cpp`, `*.hpp`, `go.mod`, `go.sum`, `go.work` are hashed and copied. Anything else (e.g. data files, `.json` configs) is *not*. If your plugin needs to read a data file at runtime, embed it via `//go:embed` so it's part of the binary.
- **Did you check the right cache dir?** Normal projects use `node_modules/.ttsc/plugins/`; projects without `node_modules/` use `.ttsc/plugins/`. `TTSC_CACHE_DIR` overrides both only when explicitly set.
- **Is the scratch dir a clue?** Force a build failure (e.g. break a `.go` file syntactically) and check `<cache>/scratch-*` immediately after — `ttsc` only deletes the scratch on success. The `go.work` file there shows exactly what overlay was applied.

## Logging

By default `ttsc` writes one stderr line per cache miss:

```
ttsc: building source plugin "my-plugin" from /abs/path/go-plugin (this runs once per cache key)
```

Cache hits log nothing. There is no separate `--verbose` flag for plugin builds today; the `--verbose` build flag affects the per-plugin pipeline summary, not the build orchestration.

## Concurrency

`ttsc` itself is single-threaded but plugin builds are safe under concurrent invocations:

- Each `ttsc` process creates its own `scratch-<key>-<pid>-<timestamp>/` directory, so no two processes write to the same scratch.
- The final `<cache>/<key>/plugin` is produced by `fs.renameSync`, which is atomic on POSIX and on Windows (single filesystem). The "last writer wins" but every build that uses the same `<key>` produces a bit-identical binary, so the winner doesn't matter.
- Cache *reads* are simple `fs.existsSync` + `spawnSync` — they don't take any lock.

If two consumer processes both miss the same cache key simultaneously, both will build. That's wasteful but correct. For the typical case (one developer, one terminal) it never happens; for parallelized CI fan-out, expect occasional duplicate builds for the very first invocation across N machines.

## Things `ttsc` deliberately does not do

- **Run `go mod tidy`** in your scratch dir. This would silently rewrite your `go.sum`. The overlay's `use` directives are enough to resolve imports without tidying.
- **Vendor your dependencies.** The `go.work` overlay handles resolution at build time; vendoring would defeat that.
- **Cache the scratch dir between builds.** Scratch is per-build, deleted on success, so a failed build's state doesn't poison the next attempt.
- **Watch your plugin source for changes.** If you edit your plugin's `.go` files mid-session, the next `ttsc` invocation will rehash → cache miss → rebuild. There is no file-watcher daemon.
