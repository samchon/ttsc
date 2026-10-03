package host_test

import (
  "context"
  "fmt"
  "io"
  "testing"

  "github.com/samchon/ttsc/packages/wasm/host"
)

// TestPluginInvocationPanicWaitsForChildrenAndClosesOwnership verifies that a
// panic from Plugin.Run still cancels the invocation, waits for the children it
// registered, closes its streams, and then reaches the caller unchanged.
//
// InvokePlugin has no result to return on that path, so the invocation handle
// the plugin kept is the only observer of what the deferred finalization did. A
// finalization that skipped the wait would let a child write after the streams
// closed, one that skipped the cancellation would leave a cooperative child
// running, and one that recovered the panic would hide the plugin's failure
// from the browser host's rejection path.
//
// 1. Run a plugin that registers a child blocked on its context and then panics.
// 2. Recover the panic in the caller and read the invocation afterwards.
// 3. Assert the panic value arrived unchanged, the child saw the cancellation and
//    wrote before the streams closed, and registration and writes are closed.
//
// @evidence contracts/testing.md#behavioral-verification Panics from Run with a registered child and asserts the panic value reaches the caller, the child observed the cancellation and wrote before the streams closed, and registration and writes are closed afterwards, so a swallowed panic, a skipped wait or a missing cancellation fails.
// @evidence contracts/testing.md#independent-expectations The panic value and the child write error are authored in the test; io.ErrClosedPipe and a canceled context are the documented closed-ownership results.
// @evidence contracts/testing.md#distinguishing-cases A blocked cooperative child, the panic itself, and the post-panic registration and write attempts on both streams are the cases; normal return is owned by the ownership test.
// @evidence contracts/testing.md#execution-ownership Calls InvokePlugin directly in the native Go test process, where the plugin double keeps the invocation handle that is the only observer of the failed call.
func TestPluginInvocationPanicWaitsForChildrenAndClosesOwnership(t *testing.T) {
  var invocation *host.PluginInvocation
  childWrite := fmt.Errorf("child never wrote")
  childSawCancellation := false
  plugin := invocationPlugin{name: "panics", run: func(current *host.PluginInvocation) int {
    invocation = current
    registered := current.Go(func(ctx context.Context) {
      <-ctx.Done()
      childSawCancellation = ctx.Err() == context.Canceled
      _, childWrite = io.WriteString(current.Stdout, "child-after-cancel")
    })
    if !registered {
      t.Error("child registration was rejected while Run was active")
    }
    panic("plugin failure")
  }}

  var recovered any
  func() {
    defer func() { recovered = recover() }()
    host.InvokePlugin(context.Background(), plugin, "run", nil)
  }()

  if recovered != "plugin failure" {
    t.Fatalf("panic reached the caller as %#v, want the plugin's own value", recovered)
  }
  if !childSawCancellation {
    t.Fatal("the registered child was not canceled by the panic")
  }
  if childWrite != nil {
    t.Fatalf("the child could not write before the streams closed: %v", childWrite)
  }
  if invocation.Context.Err() == nil {
    t.Fatal("the invocation context stayed live after the panic")
  }
  if invocation.Go(func(context.Context) {}) {
    t.Fatal("child registration succeeded after the panic")
  }
  if _, err := io.WriteString(invocation.Stdout, "late"); err != io.ErrClosedPipe {
    t.Fatalf("late stdout write error = %v, want %v", err, io.ErrClosedPipe)
  }
  if _, err := io.WriteString(invocation.Stderr, "late"); err != io.ErrClosedPipe {
    t.Fatalf("late stderr write error = %v, want %v", err, io.ErrClosedPipe)
  }
}
