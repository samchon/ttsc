package host_test

import (
  "bytes"
  "context"
  "fmt"
  "io"
  "os"
  "strings"
  "sync"
  "testing"

  "github.com/samchon/ttsc/packages/wasm/host"
)

type invocationPlugin struct {
  name string
  run  func(*host.PluginInvocation) int
}

func (plugin invocationPlugin) Name() string { return plugin.name }

func (plugin invocationPlugin) Run(invocation *host.PluginInvocation) int {
  return plugin.run(invocation)
}

// TestPluginInvocationOutputOwnership proves that normal writes, registered
// child writes, concurrent calls, and late writes all stay inside the request
// that owns their writers. It prevents the browser host from regressing to
// process-global stdout/stderr capture.
func TestPluginInvocationOutputOwnership(t *testing.T) {
  t.Run("leaves unrelated process output outside the result", func(t *testing.T) {
    originalStdout, originalStderr := os.Stdout, os.Stderr
    ready := make(chan struct{})
    release := make(chan struct{})
    result := make(chan host.APIResult, 1)
    plugin := invocationPlugin{name: "global-sentinel", run: func(invocation *host.PluginInvocation) int {
      close(ready)
      <-release
      fmt.Fprint(invocation.Stdout, "owned-stdout")
      fmt.Fprint(invocation.Stderr, "owned-stderr")
      return 0
    }}
    go func() {
      result <- host.InvokePlugin(context.Background(), plugin, "run", nil)
    }()
    <-ready

    // This write is deliberately unrelated to the invocation and occurs while
    // Plugin.Run is active. InvokePlugin must never redirect the exported
    // process-global file pointers to its request-owned buffers.
    fmt.Fprint(os.Stdout, "unrelated-process-sentinel")
    close(release)
    got := <-result

    if os.Stdout != originalStdout || os.Stderr != originalStderr {
      t.Fatal("InvokePlugin mutated process-global stdout or stderr")
    }
    if bytes.Contains([]byte(got.Stdout), []byte("unrelated-process-sentinel")) ||
      bytes.Contains([]byte(got.Stderr), []byte("unrelated-process-sentinel")) {
      t.Fatalf("unrelated process output entered invocation result: %#v", got)
    }
    if got.Stdout != "owned-stdout" || got.Stderr != "owned-stderr" {
      t.Fatalf("unexpected owned output: %#v", got)
    }
  })

  t.Run("captures normal and registered child output", func(t *testing.T) {
    childRelease := make(chan struct{})
    result := make(chan host.APIResult, 1)
    plugin := invocationPlugin{name: "child", run: func(invocation *host.PluginInvocation) int {
      fmt.Fprint(invocation.Stdout, "parent")
      if !invocation.Go(func(context.Context) {
        <-childRelease
        fmt.Fprint(invocation.Stderr, "child")
      }) {
        t.Fatal("child registration was rejected while Run was active")
      }
      return 7
    }}
    go func() {
      result <- host.InvokePlugin(context.Background(), plugin, "build", []string{"one"})
    }()
    close(childRelease)
    got := <-result
    if got.Code != 7 || got.Stdout != "parent" || got.Stderr != "child" {
      t.Fatalf("unexpected result: %#v", got)
    }
  })

  t.Run("separates concurrent invocations", func(t *testing.T) {
    start := make(chan struct{})
    var ready sync.WaitGroup
    ready.Add(2)
    plugin := invocationPlugin{name: "concurrent", run: func(invocation *host.PluginInvocation) int {
      ready.Done()
      <-start
      for range 32 {
        fmt.Fprint(invocation.Stdout, invocation.Args[0])
        fmt.Fprint(invocation.Stderr, invocation.Args[1])
      }
      return 0
    }}
    results := make(chan host.APIResult, 2)
    go func() {
      results <- host.InvokePlugin(context.Background(), plugin, "run", []string{"A-out", "A-err"})
    }()
    go func() {
      results <- host.InvokePlugin(context.Background(), plugin, "run", []string{"B-out", "B-err"})
    }()
    ready.Wait()
    close(start)
    want := map[string]string{
      strings.Repeat("A-out", 32): strings.Repeat("A-err", 32),
      strings.Repeat("B-out", 32): strings.Repeat("B-err", 32),
    }
    for range 2 {
      got := <-results
      stderr, ok := want[got.Stdout]
      if !ok || got.Stderr != stderr {
        t.Fatalf("concurrent output was contaminated or incomplete: %#v", got)
      }
      delete(want, got.Stdout)
    }
    if len(want) != 0 {
      t.Fatalf("missing concurrent invocation results: %#v", want)
    }
  })

  t.Run("closes ownership after Run returns", func(t *testing.T) {
    var invocation *host.PluginInvocation
    plugin := invocationPlugin{name: "late", run: func(current *host.PluginInvocation) int {
      invocation = current
      fmt.Fprint(current.Stdout, "owned")
      return 0
    }}
    got := host.InvokePlugin(context.Background(), plugin, "run", nil)
    if got.Stdout != "owned" {
      t.Fatalf("unexpected captured output: %q", got.Stdout)
    }
    if invocation.Go(func(context.Context) {}) {
      t.Fatal("child registration succeeded after Run returned")
    }
    if _, err := io.WriteString(invocation.Stdout, "late"); err != io.ErrClosedPipe {
      t.Fatalf("late write error = %v, want %v", err, io.ErrClosedPipe)
    }
    if got.Stdout != "owned" {
      t.Fatalf("completed result changed after late write: %q", got.Stdout)
    }
  })
}
