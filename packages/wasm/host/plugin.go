package host

// API stability: experimental until v1.0; signatures may change between
// minor releases. Pin exact versions in production playgrounds.
//
// Plugin is the in-process equivalent of ttsc's native CLI sidecar.
//
// The native CLI invokes plugins by spawning their binary with argv (e.g.
// `@ttsc/lint check --tsconfig=tsconfig.json --plugins-json=...`). Inside the
// wasm there is no subprocess support, so the consumer wasm bundles plugin
// code directly and exposes the same dispatch through Plugin.Run.
//
// A typical Plugin implementation in the consumer wasm is a thin adapter that
// forwards to the same Run* function the native sidecar's `main.go` calls:
//
//  type bannerPlugin struct{}
//
//  func (bannerPlugin) Name() string { return "@ttsc/banner" }
//  func (bannerPlugin) Run(command string, args []string) int {
//    switch command {
//    case "build":     return utility.RunBuild(args)
//    case "check":     return utility.RunCheck(args)
//    case "transform": return utility.RunTransform(args)
//    default:          return 2
//    }
//  }
//
// The host installs the package-level writers in `runWithCapturedIO` before
// calling Run, so anything the plugin writes to ttsc's `stdout` / `stderr`
// streams is captured and returned to the JS caller.
type Plugin interface {
  // Name is the npm-style plugin id (e.g. `@ttsc/banner`). The JS side
  // passes this exact string when dispatching: `api.plugin("@ttsc/banner",
  // "build", opts)`. Names must be unique within a Config.
  Name() string

  // Run dispatches a subcommand. `command` is the verb the JS caller asked
  // for (typically build / check / transform / fix / format / version);
  // `args` is the rest of the argv, already prefixed with `--flag=value`
  // pairs the host built from the JS options object.
  //
  // Return the exit code (0 for success, 2 for usage errors, 3 for runtime
  // errors — mirrors the native CLI exit-code contract). Anything written
  // to `os.Stdout` / `os.Stderr` is captured by the host.
  //
  // API stability: experimental until v1.0; the signature is expected to
  // change to `Run(ctx *PluginContext) int` in a follow-up release.
  Run(command string, args []string) int
}

// Config carries the optional registrations the host applies before binding
// `globalThis[name]`. Pass `Config{}` for a vanilla ttsc + tsgo wasm.
type Config struct {
  // Plugins are dispatched through `api.plugin(name, command, opts)` from
  // JS. Their Run methods share the same `os.Stdout` / `os.Stderr` streams
  // the base build/check/transform endpoints use, so diagnostics render
  // the same way no matter which lane produced them.
  Plugins []Plugin
}
