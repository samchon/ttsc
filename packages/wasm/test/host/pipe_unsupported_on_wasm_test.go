//go:build js && wasm

package host_test

import (
  "errors"
  "os"
  "syscall"
  "testing"
)

// TestPipeUnsupportedOnWasm pins the syscall boundary the `@ttsc/wasm` MemFS
// documents: under the pinned Go toolchain neither `GOOS=js` nor `GOOS=wasip1`
// has pipes, so `os.Pipe` fails with ENOSYS without ever crossing the
// `globalThis.fs` bridge. The MemFS `pipe2` shim therefore cannot be reached
// from Go, and `IWasmExecFS.pipe2` documents itself as JavaScript-only.
//
// If a future toolchain gains js/wasm pipes this test turns red, so the shim's
// contract is revisited deliberately instead of drifting back into a claim the
// implementation cannot honor.
//
// The suite is compiled for js/wasm, so it runs through the toolchain's wasm
// exec wrapper:
//
//  GOOS=js GOARCH=wasm go test \
//    -exec="node $(go env GOROOT)/lib/wasm/wasm_exec_node.js" ./test/host/
func TestPipeUnsupportedOnWasm(t *testing.T) {
  reader, writer, err := os.Pipe()
  if err == nil {
    if reader != nil {
      reader.Close()
    }
    if writer != nil {
      writer.Close()
    }
    t.Fatal("os.Pipe succeeded on js/wasm; the MemFS pipe2 contract must be revisited")
  }
  if reader != nil || writer != nil {
    t.Fatalf("failed os.Pipe returned files: reader=%v writer=%v", reader, writer)
  }
  if !errors.Is(err, syscall.ENOSYS) {
    t.Fatalf("expected an ENOSYS-bearing error, got %v", err)
  }

  var fds [2]int
  if err := syscall.Pipe(fds[:]); !errors.Is(err, syscall.ENOSYS) {
    t.Fatalf("expected syscall.Pipe to report ENOSYS, got %v", err)
  }
}
