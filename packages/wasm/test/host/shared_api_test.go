//go:build js && wasm

package host_test

import (
  "fmt"
  "sync"
  "syscall/js"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/wasm/host"
)

// sharedAPIName is the global the suite's single host.Expose binds.
//
// Expose refuses a second call in one wasm instance, so every case that needs
// the JS API shares this registration instead of installing its own.
const sharedAPIName = "ttscHostTest"

var exposeSharedAPI sync.Once

// argvEchoPlugin reports exactly what dispatch handed to Run, so a case can
// compare the forwarded command and argument vector with its own literals.
type argvEchoPlugin struct{}

func (argvEchoPlugin) Name() string { return "argv-echo" }

func (argvEchoPlugin) Run(invocation *host.PluginInvocation) int {
  fmt.Fprintln(invocation.Stdout, invocation.Command)
  for _, arg := range invocation.Args {
    fmt.Fprintln(invocation.Stdout, arg)
  }
  fmt.Fprint(invocation.Stderr, "echoed")
  return 7
}

// startSharedAPI exposes the suite's JS API once and returns it.
func startSharedAPI(t *testing.T) js.Value {
  t.Helper()
  exposeSharedAPI.Do(func() {
    go host.Expose(sharedAPIName, host.Config{Plugins: []host.Plugin{argvEchoPlugin{}}})
  })
  deadline := time.Now().Add(30 * time.Second)
  for time.Now().Before(deadline) {
    api := js.Global().Get(sharedAPIName)
    if api.Type() == js.TypeObject {
      return api
    }
    time.Sleep(time.Millisecond)
  }
  t.Fatalf("%s did not become available", sharedAPIName)
  return js.Undefined()
}
