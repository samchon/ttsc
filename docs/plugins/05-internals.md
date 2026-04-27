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
$TTSC_CACHE_DIR/plugins/                    # or $XDG_CACHE_HOME/ttsc/plugins, or ~/.cache/ttsc/plugins
├── <key-1>/
│   └── plugin                              # cached binary (or plugin.exe on Windows)
├── <key-2>/
│   └── plugin
└── ...
```

There is one binary per cache key. Scratch dirs are deleted after each successful build — if you see `scratch-*` directories left behind, a build crashed mid-flight.

### Where the cache lives

In priority order:

1. `$TTSC_CACHE_DIR/plugins/` if `TTSC_CACHE_DIR` is set (used in tests for isolation)
2. `$XDG_CACHE_HOME/ttsc/plugins/` if XDG is set
3. `$HOME/.cache/ttsc/plugins/`

To force a full rebuild, delete the cache root or set `TTSC_CACHE_DIR` to a fresh directory.

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
| Edit consumer's TypeScript source | ✗ (only the plugin's source affects the cache) |

## Go toolchain

`ttsc` invokes `go build` directly. It looks for the toolchain in this order:

1. `TTSC_GO_BINARY` env var if set (must be an absolute path)
2. `go` on `PATH`

If neither is found, `ttsc` exits with:

```
ttsc: building plugin "..." failed because the Go toolchain was not found.
Install Go (https://go.dev/dl/) or set TTSC_GO_BINARY to an absolute path.
```

> **Roadmap.** A future release will bundle the Go toolchain as platform-specific npm subpackages (`ttsc-go-linux-x64`, `ttsc-go-darwin-arm64`, …) under `optionalDependencies`, so consumers don't need a system Go install. This will follow the same delivery channel `ttsc`'s own native binaries already use. Tracking under issue #14 / its successor.

## Debugging a failing build

When a `go build` fails inside `ttsc`, the underlying `go` command's stderr is included verbatim:

```
ttsc: building plugin "my-plugin" via "go build" failed:
go-plugin/main.go:42:8: undefined: shimast.SomethingThatDoesNotExist
```

Things to check:

- **Did you forget the require line?** `no required module provides package github.com/microsoft/typescript-go/shim/...` → see [tsgo.md](./03-tsgo.md#how-to-use-a-shim--the-current-rules).
- **Is your source actually in the cache key?** Files matching `*.go`, `*.s`, `*.c`, `*.h`, `*.cpp`, `*.hpp`, `go.mod`, `go.sum`, `go.work` are hashed and copied. Anything else (e.g. data files, `.json` configs) is *not*. If your plugin needs to read a data file at runtime, embed it via `//go:embed` so it's part of the binary.
- **Did you check the right cache dir?** `TTSC_CACHE_DIR` overrides the default location. `printenv TTSC_CACHE_DIR` from the consumer process if you suspect a misroute.
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
