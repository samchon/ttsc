package host_test

import (
  "context"
  "fmt"
  "io"
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
        fmt.Fprint(invocation.Stderr, invocation.Args[0])
      }
      return 0
    }}
    results := make(chan host.APIResult, 2)
    go func() { results <- host.InvokePlugin(context.Background(), plugin, "run", []string{"A"}) }()
    go func() { results <- host.InvokePlugin(context.Background(), plugin, "run", []string{"B"}) }()
    ready.Wait()
    close(start)
    for range 2 {
      got := <-results
      if got.Stdout == "" || got.Stdout != got.Stderr {
        t.Fatalf("mismatched streams: %#v", got)
      }
      if strings.Contains(got.Stdout, "A") && strings.Contains(got.Stdout, "B") {
        t.Fatalf("concurrent output was contaminated: %q", got.Stdout)
      }
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
