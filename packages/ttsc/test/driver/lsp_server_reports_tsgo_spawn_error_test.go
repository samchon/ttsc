package driver_test

import (
  "context"
  "io"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPServerReportsTsgoSpawnError verifies process-start failures keep the
// tsgo command context in the returned error.
//
// Missing or non-executable @typescript/native-preview binaries should produce
// an actionable upstream failure instead of a generic proxy shutdown.
//
// 1. Point TsgoBinary at a missing absolute path.
// 2. Close editor input immediately so the proxy side can drain.
// 3. Assert the returned error names `tsgo --lsp --stdio`.
func TestLSPServerReportsTsgoSpawnError(t *testing.T) {
  err := driver.RunLSPServer(context.Background(), driver.LSPServerOptions{
    In:         strings.NewReader(""),
    Out:        io.Discard,
    Err:        io.Discard,
    Cwd:        t.TempDir(),
    TsgoBinary: filepath.Join(t.TempDir(), "missing-tsgo"),
  })
  if err == nil || !strings.Contains(err.Error(), "tsgo --lsp --stdio") {
    t.Fatalf("expected tsgo spawn error, got %v", err)
  }
}
