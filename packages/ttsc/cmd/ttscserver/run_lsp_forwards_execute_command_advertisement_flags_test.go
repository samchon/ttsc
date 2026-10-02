package main

import (
  "bytes"
  "context"
  "reflect"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestRunLSPForwardsExecuteCommandAdvertisementFlags verifies the native
// command passes executeCommand registration controls into the LSP host.
//
// The VS Code extension relies on these flags to suppress wrapper-owned command
// ids and namespace custom plugin commands per project root. Parsing the flags
// in the command is not enough; this pins the handoff into LSPServerOptions.
//
// 1. Substitute the runLSPServer seam and capture its options.
// 2. Run runLSP with suppression and prefix flags.
// 3. Assert the captured LSPServerOptions carry the parsed values.
//
// @evidence contracts/testing.md#behavioral-verification runLSP passes the suppress-execute-command-provider and command-prefix flags into the LSPServerOptions given to the LSP host.
// @evidence contracts/testing.md#independent-expectations The expected option values are the literal flag values supplied on the command line.
// @evidence contracts/testing.md#distinguishing-cases Both a suppression flag and a prefix flag are supplied so a handoff that drops either is detected.
// @evidence contracts/testing.md#execution-ownership TestRunLSPForwardsExecuteCommandAdvertisementFlags is a Go unit test in the cmd/ttscserver package: it calls runLSP in-process with the runLSPServer or getwd seam replaced and captured streams, starting neither tsgo nor a product process.
func TestRunLSPForwardsExecuteCommandAdvertisementFlags(t *testing.T) {
  prev := runLSPServer
  var captured lspserver.LSPServerOptions
  runLSPServer = func(_ context.Context, opts lspserver.LSPServerOptions) error {
    captured = opts
    return nil
  }
  defer func() { runLSPServer = prev }()

  outBuf := &bytes.Buffer{}
  errBuf := &bytes.Buffer{}
  withIO(t, outBuf, errBuf, nil, func() {
    if code := runLSP([]string{
      "--stdio",
      "--cwd", t.TempDir(),
      "--suppress-execute-command-provider",
      "--suppress-execute-command-ids", " ttsc.lint.fixAll, ttsc.format.document ,, ",
      "--execute-command-id-prefix", " ttsc.vscode.root. ",
    }); code != 0 {
      t.Fatalf("expected exit 0, got %d (stderr=%q)", code, errBuf.String())
    }
  })

  if !captured.SuppressExecuteCommandProvider {
    t.Fatal("expected SuppressExecuteCommandProvider to be true")
  }
  expectedIDs := []string{"ttsc.lint.fixAll", "ttsc.format.document"}
  if !reflect.DeepEqual(captured.SuppressedExecuteCommandIDs, expectedIDs) {
    t.Fatalf("expected suppressed ids %#v, got %#v", expectedIDs, captured.SuppressedExecuteCommandIDs)
  }
  if captured.ExecuteCommandIDPrefix != "ttsc.vscode.root." {
    t.Fatalf("expected trimmed execute command prefix, got %q", captured.ExecuteCommandIDPrefix)
  }
}
