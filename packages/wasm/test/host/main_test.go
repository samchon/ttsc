//go:build js && wasm

package host_test

import (
  "fmt"
  "os"
  "runtime"
  "strings"
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
  // The stacks go out on their own write, before anything else is attempted.
  // Reading the JS side means calling into node, and the runtime does not
  // catch every way that can end: a throwing property accessor reached through
  // `Value.Get` leaves as an uncaught JS exception and takes the process with
  // it, printing nothing from Go. Composing both halves into one message would
  // let that destroy the half already in hand.
  writeStderr(fmt.Sprintf(
    "\nwasm host suite: no exit within %s.\n"+
      "Every goroutine stack follows, and what node was still holding after\n"+
      "it; the suite self-terminates instead of waiting for go test to\n"+
      "SIGQUIT the node wrapper and report nothing.\n\n%s\n",
    suiteBudget,
    buffer,
  ))
  writeStderr("node was holding: " + nodePendingWork() + "\n")
  os.Exit(1)
}

// nodeResourceSummary reads the discriminator alone.
//
// It exists so a caller that only needs to know the reading works can take it
// without entering the per-handle detail path, which reads properties off live
// node objects and cannot survive one that throws. The guard accepts that
// exposure because it runs only when the suite is already lost and the stacks
// are already written; a case on the healthy path would be trading something
// else entirely.

// nodePendingWork asks node what its event loop is still waiting on.
//
// The goroutine stacks alone cannot finish the diagnosis. Both candidate
// causes park the main goroutine in the same place, a channel receive inside
// syscall.fsCall, so the Go side reads identically whether node never fired
// the write completion or fired it and the runtime failed to route it. What
// separates them is whether node still holds a pending file request, and only
// node can answer that.
//
// It is asked from here rather than from the wrapper's own timer, because
// whichever guard fires first ends the process: a reading the wrapper takes at
// a later budget is a reading that never happens on any occurrence this guard
// catches. Both halves therefore come from one stop.
//
// The call is synchronous, in the sense fs.writeSync is, so it cannot depend on
// the event delivery that is already suspect.
//
// Read the result together with the stacks above it, never alone. This runs
// inside the timer callback node used to resume the runtime, and a healthy
// program parked there holds nothing at all, so an all-empty reading is only
// the verdict "node completed the write" when the stacks also show the main
// goroutine parked in a channel receive inside syscall.fsCall.
func nodeResourceSummary() string {
  process := js.Global().Get("process")
  if process.Type() != js.TypeObject {
    return "<absent>"
  }
  if process.Get("getActiveResourcesInfo").Type() != js.TypeFunction {
    return "<absent>"
  }
  return describeJSList(process.Call("getActiveResourcesInfo"))
}

func nodePendingWork() (reading string) {
  readings := []string{}
  // A reading that fails says so and keeps the ones already taken.
  //
  // `getActiveResourcesInfo` is collected first and is the discriminator; the
  // two underscore-prefixed internals after it are the ones likelier to
  // misbehave, so a failure there must not carry the answer away with it.
  //
  // The recover covers less than it looks like it does. `Value.Call` routes a
  // JS throw back as a Go panic, but `Value.Get` is a bare `Reflect.get` in
  // the runtime's import table with no catch around it, so a throwing property
  // accessor escapes as an uncaught JS exception and ends the process without
  // reaching any Go code at all. That is why the stacks are written before
  // this runs: the artifact already in hand cannot be lost to it.
  defer func() {
    if recovered := recover(); recovered != nil {
      reading = strings.Join(append(
        readings,
        fmt.Sprintf("unavailable: a reading panicked (%v)", recovered),
      ), " ")
    }
  }()
  process := js.Global().Get("process")
  if process.Type() != js.TypeObject {
    return "unavailable: no process object"
  }
  for _, name := range []string{
    "getActiveResourcesInfo",
    "_getActiveRequests",
    "_getActiveHandles",
  } {
    if process.Get(name).Type() != js.TypeFunction {
      readings = append(readings, name+"=<absent>")
      continue
    }
    readings = append(readings, name+"="+describeJSList(process.Call(name)))
  }
  return strings.Join(readings, " ")
}

// describeJSList renders one reading, naming each entry by constructor and by
// the fields that would tell a wedged pipe from a drained one.
//
// A list that is not a list is named as such rather than rendered empty. An
// empty list is not a neutral value here: it is the affirmative verdict that
// node holds nothing, which is the whole of one candidate cause, so a reading
// that merely failed to produce a list must not be able to spell it.
//
// The test is `Array.isArray` rather than a type check, because a plain object
// is an object: `Length` on one reads an absent `length` as zero, the loop
// never runs, and the reading renders as the verdict it is not.
func describeJSList(list js.Value) string {
  if !js.Global().Get("Array").Call("isArray", list).Bool() {
    return "<not a list>"
  }
  entries := []string{}
  for index := 0; index < list.Length(); index++ {
    entry := list.Index(index)
    if entry.Type() == js.TypeString {
      entries = append(entries, entry.String())
      continue
    }
    entries = append(entries, describeJSHandle(entry))
  }
  return "[" + strings.Join(entries, ", ") + "]"
}

// describeJSHandle names one held resource.
//
// The detail fields are absent on the pending file request this guard expects
// to meet, so it usually renders the same token `getActiveResourcesInfo`
// already printed. They are read anyway because a held socket carries them,
// and a socket appearing here at all would itself be the finding.
func describeJSHandle(handle js.Value) string {
  name := "unknown"
  if constructor := handle.Get("constructor"); constructor.Type() == js.TypeObject ||
    constructor.Type() == js.TypeFunction {
    if named := constructor.Get("name"); named.Type() == js.TypeString {
      name = named.String()
    }
  }
  detail := []string{}
  for _, field := range []string{"fd", "writableLength", "bytesWritten"} {
    if value := handle.Get(field); value.Type() == js.TypeNumber {
      detail = append(detail, fmt.Sprintf("%s=%d", field, value.Int()))
    }
  }
  if len(detail) == 0 {
    return name
  }
  return name + "(" + strings.Join(detail, " ") + ")"
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
