//go:build js && wasm

package host_test

import (
  "fmt"
  "os"
  "runtime"
  "syscall/js"
  "testing"
  "time"
)

// suiteBudget bounds one whole run of this suite, teardown included.
//
// Every measured green CI run finished the package in 0.44s-0.93s, so the
// budget is a ~130x margin that only a wedged runtime can reach. It has to sit
// well below `go test`'s own kill, because that kill produces no evidence
// here: the -exec wrapper is node, so the SIGQUIT lands on node and dumps a
// node process, never the Go goroutines running inside the wasm module.
const suiteBudget = 120 * time.Second

// TestMain arms a teardown guard that outlives the tests themselves.
//
// Three CI runs -- 30661299811 on feat/incremental-graph-snapshots,
// 30970615435 on feat/evidence-package, and 31080957168 on
// campaign/evidence-luna-0.24.0 -- ended identically: every test passed, the
// binary wrote "PASS", and then the process never exited until `go test`
// killed it at 11m0s, 662s into a package that otherwise takes under a second.
// testing's own -test.timeout alarm never fired, which places the stall after
// M.Run stopped that alarm: in the epilogue that writes "PASS" and calls
// os.Exit, where a js/wasm stdout write reaches node but its completion event
// is never delivered back into the Go runtime.
//
// Nothing inside the process can recover from that unaided. host.Expose, which
// this suite starts to obtain the JS API, deliberately keeps a perpetual
// hourly keepalive goroutine alive for the rest of the binary, so node's event
// loop always holds a pending timer. wasm_exec_node.js only rescues a stalled
// program from its process "exit" hook, which fires when the loop drains --
// so the hook that would otherwise force Go to print every goroutine stack can
// never run here.
//
// The guard is therefore never stopped: the stall it exists for happens after
// the last test, so a timer scoped to the tests would already be disarmed by
// the time it mattered. On a healthy run the process exits in under a second
// and the pending timer is simply discarded with it.
func TestMain(m *testing.M) {
  time.AfterFunc(suiteBudget, reportStallAndExit)
  os.Exit(m.Run())
}

// reportStallAndExit dumps every goroutine and terminates the process.
//
// This is the artifact the 11-minute kill cannot produce. os.Exit reaches
// node through the runtime.wasmExit host call, which is synchronous and so
// cannot depend on the event delivery that stalled in the first place.
func reportStallAndExit() {
  buffer := make([]byte, 1<<20)
  buffer = buffer[:runtime.Stack(buffer, true)]
  writeStderr(fmt.Sprintf(
    "\nwasm host suite: no exit within %s.\n"+
      "Every goroutine stack follows; the suite self-terminates instead of\n"+
      "waiting for go test to SIGQUIT the node wrapper and report nothing.\n\n%s\n",
    suiteBudget,
    buffer,
  ))
  os.Exit(1)
}

// writeStderr bypasses os.Stderr on purpose.
//
// A js/wasm write to fd 2 goes through fs.write and blocks the calling
// goroutine until JS hands the completion back -- the exact mechanism that is
// already suspect when this runs. wasm_exec_node.js binds node's real fs to
// globalThis, so fs.writeSync returns without ever suspending the runtime.
func writeStderr(text string) {
  if fs := js.Global().Get("fs"); fs.Type() == js.TypeObject {
    if writeSync := fs.Get("writeSync"); writeSync.Type() == js.TypeFunction {
      fs.Call("writeSync", 2, text)
      return
    }
  }
  fmt.Fprint(os.Stderr, text)
}
