# @ttsc/wasm

> **API stability: experimental until v1.0.** Public signatures (`Plugin.Run`, the `host.Expose` argv shape, the JS `ITtscApi` surface, the linker-symbol contract below) may change between minor releases. Pin exact versions in production playgrounds.

In-browser ttsc playground scaffolding. Compose ttsc + typescript-go with your own plugins by writing a single Go entry that calls `host.Expose(...)`, then boot it from JS with `bootTtsc(...)`.

## What you get

- A base `ttsc.wasm` (under `dist/`) that exposes vanilla `build` / `check` / `transform` — no plugins linked. Useful as a sanity test or a no-plugin baseline.
- A Go helper package (`host/`) plugin authors import from their own `main_wasm.go` to bind a wasm to `globalThis[yourApiName]`.
- A JS runtime (`bootTtsc`, `createMemFS`, typed `ITtscApi` surface) that loads any host-built wasm into a Web Worker.

The package is plugin-agnostic. Downstream playgrounds (the ttsc.dev website, typia, anything else) build their own wasm against the same `host/` package.

## Build your own playground in 30 lines

1. Add the dependency:

```bash
npm install -D @ttsc/wasm
```

2. Create `your-pkg/cmd/your-wasm/main_wasm.go`:

```go
//go:build js && wasm

package main

import (
  "github.com/samchon/ttsc/packages/wasm/host"
  yourplugin "example.com/your/plugin"
)

func main() {
  host.Expose("yourApi", host.Config{
    Plugins: []host.Plugin{yourplugin.New()},
  })
}
```

The native sibling `main.go` is recommended when you want `go run ./cmd/your-wasm`
to smoke-test the same `host.Plugin` dispatchers without the browser MemFS
bridge. See `packages/wasm/cmd/ttsc-wasm/main.go` and
`website/compiler/cmd/playground/main.go` in the repo for reference layouts.
A minimal custom plugin dispatcher looks like this:

```go
//go:build !js

package main

import (
  "fmt"
  "os"

  "github.com/samchon/ttsc/packages/wasm/host"
  yourplugin "example.com/your/plugin"
)

func main() {
  plugins := []host.Plugin{yourplugin.New()}
  if len(os.Args) >= 3 {
    name, command := os.Args[1], os.Args[2]
    for _, p := range plugins {
      if p.Name() == name {
        os.Exit(p.Run(command, os.Args[3:]))
      }
    }
  }
  fmt.Fprintln(os.Stderr, "usage: your-wasm <plugin> <command> [args...]")
  os.Exit(2)
}
```

3. Build the wasm:

```bash
GOOS=js GOARCH=wasm go build -trimpath -ldflags "-s -w" \
  -o public/your.wasm ./cmd/your-wasm
cp "$(go env GOROOT)/lib/wasm/wasm_exec.js" public/wasm_exec.js
```

Keep `wasm_exec.js` from the same Go toolchain that built your wasm. The
prebuilt `dist/ttsc.wasm` and `dist/wasm_exec.js` pair already match each
other; custom binaries should copy the loader from their own toolchain. Older
Go installs may keep the loader under `$(go env GOROOT)/misc/wasm/wasm_exec.js`
instead of `lib/wasm`.

### Stamping version metadata at link time

The `host` package exposes a build-time variable contract you can override via `-ldflags "-X ..."`:

```bash
GOOS=js GOARCH=wasm go build -trimpath \
  -ldflags "-s -w -X github.com/samchon/ttsc/packages/wasm/host.version=$(cat package.json | jq -r .version)" \
  -o public/your.wasm ./cmd/your-wasm
```

The `version`, `commit`, and `date` variables in `host/host.go` are all overridable. `globalThis[apiName].version()` reads from them.

4. Boot it from JS (a Web Worker is **required** — Go's `syscall/js` blocks the runtime while the wasm is alive; running on the main thread freezes the page). Use a classic Worker or a bundler target that still exposes `importScripts`; `bootTtsc` imports `wasm_exec.js` before starting Go.

```ts
import { bootTtsc } from "@ttsc/wasm";

const { api, host } = await bootTtsc({
  wasmUrl: "/your.wasm",
  apiName: "yourApi",
});

host.writeFile("/work/tsconfig.json", '{"compilerOptions":{"strict":true}}');
host.writeFile("/work/src/index.ts", "export const x: number = 1;");

const result = await api.build({ cwd: "/work" });
console.log(result.result); // JSON: { diagnostics, output }
```

Booting two wasms with the same `apiName` overwrites the previous global
binding; pick a unique `apiName` per binary. `bootTtsc` also installs shared
`fs` and `process` globals in its Worker, so use separate Workers when binaries
need independent filesystems.

## Plugin contract

`host.Plugin` matches ttsc's existing CLI sidecar dispatch:

```go
type Plugin interface {
  Name() string                            // e.g. "@ttsc/banner"
  Run(command string, args []string) int   // returns CLI exit code
}
```

The host installs `globalThis[apiName].plugin({ name, command, ...opts })` that translates the JS options object into a CLI-shaped argv and calls your plugin's `Run`. Your `Run` body can forward to the same function the native sidecar's `main.go` calls — for example `utility.RunBuild(args)` for plugins backed by `packages/ttsc/utility`.

## Published-tarball Go module layout

The published `@ttsc/wasm` tarball ships:

- A rewritten root `go.mod` whose `replace` directives point at `./shim-vendor/shim/*` (vendored at pack time from `packages/ttsc/shim/`).
- The full `host/`, `cmd/`, `build/` Go source so consumers can `go build -tags '...'` their own wasm against your host helper.
- `dist/ttsc.wasm` + `dist/wasm_exec.js` — the no-plugin sanity binary and the Go runtime loader.

The tarball intentionally drops the `replace github.com/samchon/ttsc/packages/ttsc => ../ttsc` directive that the in-repo `go.mod` carries: consumers of the published module who want to rebuild the wasm must supply their own `replace` (or vendor `packages/ttsc` themselves). The published `dist/ttsc.wasm` is plug-and-play for runtime use; the Go module is for **plugin authors extending the host**, not for vanilla consumers.

## Documents

- The base wasm (`dist/ttsc.wasm`) is the binary `cmd/ttsc-wasm/main_wasm.go` produces. Look there for a minimal example.
- See the [`@ttsc/wasm` guide](https://ttsc.dev/docs/wasm) for the Worker, MemFS, plugin-host, and troubleshooting walkthrough.
