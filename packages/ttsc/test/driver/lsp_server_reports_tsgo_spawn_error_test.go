package driver_test

import (
  "context"
  "io"
  "path/filepath"
  "strings"
  "testing"
  "time"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerReportsTsgoSpawnError Verifies process-start failures keep the
// tsgo command context in the returned error.
//
// Missing or non-executable typescript binaries should produce
// an actionable upstream failure instead of a generic proxy shutdown.
//
// 1. Point TsgoBinary at a missing absolute path.
// 2. Leave editor input open so the cancel watchdog must unblock the reader.
// 3. Assert the returned error names `tsgo --lsp --stdio`.
//
// @evidence contracts/testing.md#behavioral-verification RunLSPServer returns an error mentioning tsgo --lsp --stdio when its absolute executable path is missing, while editor input remains open.
// @evidence contracts/testing.md#independent-expectations The nonexistent temporary path independently establishes process-start failure, and the command context must remain in the reported error.
// @evidence contracts/testing.md#distinguishing-cases A missing absolute binary after validation owns launch failure and cancellation-unblocks-reader behavior; the two-second deadline bounds completion.
// @evidence contracts/testing.md#execution-ownership Go test/driver invokes the default runner launch failure directly; exec cannot start the missing child, so no native artifact is built or served.
func TestLSPServerReportsTsgoSpawnError(t *testing.T) {
  editorInR, editorInW := io.Pipe()
  defer editorInR.Close()
  defer editorInW.Close()

  done := make(chan error, 1)
  go func() {
    done <- driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
      In:         editorInR,
      Out:        io.Discard,
      Err:        io.Discard,
      Cwd:        t.TempDir(),
      TsgoBinary: filepath.Join(t.TempDir(), "missing-tsgo"),
    })
  }()

  select {
  case err := <-done:
    if err == nil || !strings.Contains(err.Error(), "tsgo --lsp --stdio") {
      t.Fatalf("expected tsgo spawn error, got %v", err)
    }
  case <-time.After(2 * time.Second):
    t.Fatal("RunLSPServer did not return after tsgo spawn failure")
  }
}
