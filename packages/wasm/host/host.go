//go:build js && wasm

// JS-side bindings for the host package.
//
// `Expose` installs `globalThis[apiName]` with the base ttsc endpoints
// (version, build, check, transform) plus a `plugin(name, command, opts)`
// dispatcher that routes into the consumer's registered plugins. The handler
// shape mirrors typia's `ttsc-typia` wasm so JS callers can build a single
// boot helper that works against any host-built binary.
package host

import (
  "fmt"
  "os"
  "runtime"
  "sync/atomic"
  "syscall/js"
  "time"
)

// Build metadata. Override at link time via
// `-ldflags "-X github.com/samchon/ttsc/packages/wasm/host.version=..."`.
var (
  version = "0.0.0-dev"
  commit  = "dev"
  date    = "unknown"
)

// API stability: experimental until v1.0; signatures may change between
// minor releases. Pin exact versions in production playgrounds.
//
// Expose installs `globalThis[apiName]` with the base API endpoints and the
// plugin dispatcher, then keeps the Go runtime alive forever.
//
// The contract:
//
//   - globalThis[apiName].version()                        → version banner
//   - globalThis[apiName].build({ cwd, tsconfig })         → Promise<CompileResult>
//   - globalThis[apiName].check({ cwd, tsconfig })         → Promise<CompileResult>
//   - globalThis[apiName].transform({ cwd, tsconfig })     → Promise<TransformResult>
//   - globalThis[apiName].plugin({ name, command, ...opts}) → Promise<APIResult>
//   - globalThis[apiName].plugins()                        → string[] of registered names
//
// A matching readiness resolver is invoked: `globalThis[`${apiName}Ready`]`.
// JS callers register this BEFORE go.run begins so they can await wasm boot.
func Expose(apiName string, cfg Config) {
  plugins := map[string]Plugin{}
  pluginNames := make([]string, 0, len(cfg.Plugins))
  for _, p := range cfg.Plugins {
    if p == nil {
      continue
    }
    name := p.Name()
    if name == "" {
      continue
    }
    if _, dup := plugins[name]; dup {
      panic(fmt.Sprintf("host.Expose: duplicate plugin name %q", name))
    }
    plugins[name] = p
    pluginNames = append(pluginNames, name)
  }

  api := map[string]any{
    "version":   js.FuncOf(jsVersion),
    "build":     js.FuncOf(jsBuild),
    "check":     js.FuncOf(jsCheck),
    "transform": js.FuncOf(jsTransform),
    "plugin":    js.FuncOf(jsPluginDispatch(plugins)),
    "plugins":   js.FuncOf(jsPluginsList(pluginNames)),
  }
  js.Global().Set(apiName, js.ValueOf(api))

  if ready := js.Global().Get(apiName + "Ready"); ready.Type() == js.TypeFunction {
    ready.Invoke()
  }

  // A perpetual idle goroutine keeps the wasm runtime alive without
  // tripping Go's deadlock detector while syscall.fsCall callbacks are in
  // flight. `select {}` alone is wrongly classified as "all goroutines
  // asleep" the moment the FS path hands a request to JS.
  go func() {
    for {
      time.Sleep(time.Hour)
    }
  }()
  select {}
}

// jsVersion returns the build metadata for this wasm binary.
func jsVersion(this js.Value, args []js.Value) any {
  return js.ValueOf(map[string]any{
    "version": version,
    "commit":  commit,
    "date":    date,
    "go":      runtime.Version(),
    "goos":    runtime.GOOS,
    "goarch":  runtime.GOARCH,
  })
}

// jsBuild → Promise<{ code, stdout, stderr, result }>. `result` carries the
// compile JSON; the surrounding shape mirrors plugin dispatch so JS callers
// can write one error-handling branch.
func jsBuild(this js.Value, args []js.Value) any {
  opts := optionsArg(args)
  return makePromise(func() any {
    return runProjectCommand(opts, Build)
  })
}

// jsCheck → Promise<{ code, stdout, stderr, result }>.
func jsCheck(this js.Value, args []js.Value) any {
  opts := optionsArg(args)
  return makePromise(func() any {
    return runProjectCommand(opts, Check)
  })
}

// jsTransform → Promise<{ code, stdout, stderr, result }>.
func jsTransform(this js.Value, args []js.Value) any {
  opts := optionsArg(args)
  return makePromise(func() any {
    return runProjectCommand(opts, Transform)
  })
}

// jsPluginDispatch routes `api.plugin({ name, command, ...opts })` to the
// matching registered Plugin's Run. The returned shape is identical to the
// base endpoints so a JS caller has one result type to handle.
func jsPluginDispatch(plugins map[string]Plugin) func(this js.Value, args []js.Value) any {
  return func(this js.Value, args []js.Value) any {
    opts := optionsArg(args)
    name := stringProp(opts, "name")
    command := stringProp(opts, "command")
    argv := buildPluginArgv(opts)
    plugin, ok := plugins[name]
    if !ok {
      return errorPromise(2, fmt.Sprintf("host: unknown plugin %q", name))
    }
    return makePromise(func() any {
      res := runWithCapturedIO(func() int {
        return plugin.Run(command, argv)
      })
      return js.ValueOf(map[string]any{
        "code":   res.Code,
        "stdout": res.Stdout,
        "stderr": res.Stderr,
        "result": "",
      })
    })
  }
}

// jsPluginsList returns the registered plugin names so JS callers can probe
// the wasm's contents at boot time.
func jsPluginsList(names []string) func(this js.Value, args []js.Value) any {
  return func(this js.Value, args []js.Value) any {
    out := make([]any, len(names))
    for i, n := range names {
      out[i] = n
    }
    return js.ValueOf(out)
  }
}

// runProjectCommand wraps the base build/check/transform endpoints into the
// uniform `{ code, stdout, stderr, result }` shape. The result string is the
// JSON the endpoint produced; JSON.parse it on the JS side.
func runProjectCommand(opts js.Value, fn func(cwd, tsconfig string) ([]byte, int, error)) any {
  cwd := stringProp(opts, "cwd")
  tsconfig := stringProp(opts, "tsconfig")
  if tsconfig == "" {
    tsconfig = "tsconfig.json"
  }
  if cwd == "" {
    return errorResponse(2, "host: \"cwd\" is required")
  }
  data, code, err := fn(cwd, tsconfig)
  if err != nil {
    return js.ValueOf(map[string]any{
      "code":   code,
      "stdout": "",
      "stderr": err.Error() + "\n",
      "result": "",
    })
  }
  return js.ValueOf(map[string]any{
    "code":   code,
    "stdout": "",
    "stderr": "",
    "result": string(data),
  })
}

// buildPluginArgv translates the JS options object into a CLI-shaped argv. We
// pass through every string / boolean property the caller set, except the
// `name` / `command` slots which the host consumes itself. This is the same
// translation typia's wasm does for `--cwd / --tsconfig / --output / ...`.
func buildPluginArgv(opts js.Value) []string {
  out := []string{}
  if opts.Type() != js.TypeObject {
    return out
  }
  keys := js.Global().Get("Object").Call("keys", opts)
  n := keys.Length()
  for i := 0; i < n; i++ {
    key := keys.Index(i).String()
    switch key {
    case "name", "command":
      continue
    }
    value := opts.Get(key)
    switch value.Type() {
    case js.TypeString:
      out = append(out, "--"+key+"="+value.String())
    case js.TypeBoolean:
      if value.Bool() {
        out = append(out, "--"+key)
      }
    case js.TypeNumber:
      out = append(out, fmt.Sprintf("--%s=%v", key, value.Float()))
    }
  }
  return out
}

// makePromise wraps a Go computation as a JS Promise. The executor
// synchronously captures the resolve/reject callbacks; the work itself runs
// in a goroutine so the JS event loop can drive `fs.stat` and friends to
// completion before we ask Go to receive the callback.
func makePromise(work func() any) js.Value {
  var executor js.Func
  executor = js.FuncOf(func(this js.Value, args []js.Value) any {
    resolve := args[0]
    reject := args[1]
    go func() {
      defer func() {
        if r := recover(); r != nil {
          err := js.Global().Get("Error").New(fmt.Sprintf("%v", r))
          reject.Invoke(err)
        }
        executor.Release()
      }()
      resolve.Invoke(work())
    }()
    return nil
  })
  return js.Global().Get("Promise").New(executor)
}

// errorPromise returns a pre-resolved Promise carrying an error response.
func errorPromise(code int, message string) js.Value {
  return makePromise(func() any { return errorResponse(code, message) })
}

// errorResponse builds the uniform JS result object for error cases.
func errorResponse(code int, message string) any {
  return js.ValueOf(map[string]any{
    "code":   code,
    "stdout": "",
    "stderr": message + "\n",
    "result": "",
  })
}

// optionsArg returns the first JS argument if it is an object, otherwise an
// empty JS object. Guards all endpoint handlers against missing or wrong-typed
// argument lists.
func optionsArg(args []js.Value) js.Value {
  if len(args) == 0 || args[0].Type() != js.TypeObject {
    return js.ValueOf(map[string]any{})
  }
  return args[0]
}

// stringProp reads a string property from a JS object. Returns "" if the
// property is absent or not a string.
func stringProp(obj js.Value, key string) string {
  v := obj.Get(key)
  if v.Type() != js.TypeString {
    return ""
  }
  return v.String()
}

// runWithCapturedIO redirects os.Stdout / os.Stderr to temp MemFS files for
// the duration of `task`. Plugin Run methods write to os.Stdout / os.Stderr
// the same way the native sidecar binaries do; capturing the output lets the
// JS host render it in a console panel without spawning a subprocess.
//
// We use MemFS temp files instead of os.Pipe because Go's js/wasm runtime
// returns `pipe: not implemented on js` for `syscall.Pipe` — pipes are not
// supported on the wasm target. The temp-file approach works because the
// MemFS shim implements file open/write/read.
func runWithCapturedIO(task func() int) APIResult {
  prevOut, prevErr := os.Stdout, os.Stderr
  // The defer is a safety net: if an early return skips the explicit restore
  // below, os.Stdout/os.Stderr are still restored. The explicit restore that
  // follows the task call is a no-op for the defer but makes the happy path
  // readable without tracing the defer.
  defer func() {
    os.Stdout = prevOut
    os.Stderr = prevErr
  }()

  stdoutPath := fmt.Sprintf("/tmp/ttsc-host-capture-%d-%d.stdout", os.Getpid(), captureCounter.Add(1))
  stderrPath := fmt.Sprintf("/tmp/ttsc-host-capture-%d-%d.stderr", os.Getpid(), captureCounter.Add(1))

  outFile, outErr := os.Create(stdoutPath)
  errFile, errErr := os.Create(stderrPath)
  if outErr != nil || errErr != nil {
    // Fall back to the original streams. Better to lose capture than the
    // call. The MemFS writeSync shim surfaces the failure to the host
    // console so the regression is visible.
    if outErr != nil {
      fmt.Fprintf(prevErr, "host.runWithCapturedIO: stdout temp file failed: %v\n", outErr)
    }
    if errErr != nil {
      fmt.Fprintf(prevErr, "host.runWithCapturedIO: stderr temp file failed: %v\n", errErr)
    }
    if outFile != nil {
      _ = outFile.Close()
      _ = os.Remove(stdoutPath)
    }
    if errFile != nil {
      _ = errFile.Close()
      _ = os.Remove(stderrPath)
    }
    return APIResult{Code: task()}
  }

  os.Stdout = outFile
  os.Stderr = errFile

  code := task()

  // Sync + close BEFORE swapping back, so the plugin's last writes hit the
  // file before we read it.
  _ = outFile.Sync()
  _ = errFile.Sync()
  _ = outFile.Close()
  _ = errFile.Close()

  os.Stdout = prevOut
  os.Stderr = prevErr

  stdoutBytes, _ := os.ReadFile(stdoutPath)
  stderrBytes, _ := os.ReadFile(stderrPath)
  _ = os.Remove(stdoutPath)
  _ = os.Remove(stderrPath)

  return APIResult{
    Code:   code,
    Stdout: string(stdoutBytes),
    Stderr: string(stderrBytes),
  }
}

// captureCounter avoids temp-file name collisions when plugin dispatches
// overlap (multiple goroutines could be in runWithCapturedIO concurrently
// from independent JS callers).
var captureCounter atomic.Uint64
