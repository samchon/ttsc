package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestLSPFormatPathsUseDefaultsWithoutLintConfig guards the editor contract
// for projects that use formatting without configuring lint at all.
//
// Code-action discovery, disk execute-command, dirty-buffer formatting, and
// the CLI must all activate the same always-on formatter defaults. In
// particular, the LSP front doors must not fail just because lint.config.json
// is absent.
//
// @evidence contracts/testing.md#behavioral-verification Code-action discovery, disk execution, dirty-buffer execution and format dispatch all activate semicolon defaults without a lint configuration.
// @evidence contracts/testing.md#independent-expectations The authored const value = 1 semicolon text and exactly one format-document action independently constrain all four front doors.
// @evidence contracts/testing.md#distinguishing-cases Absent lint configuration contrasts with the rules-only configuration companion and prevents merely testing an explicit format block.
// @evidence contracts/testing.md#execution-ownership All four front doors call the native Go host in this unit process with a disposable project; command dispatch does not spawn a CLI binary.
func TestLSPFormatPathsUseDefaultsWithoutLintConfig(t *testing.T) {
  source := "const value = 1\n"
  root := seedLintProject(t, source)

  assertCanonicalLSPFormatPaths(t, root, source, "const value = 1;\n")
}

func assertCanonicalLSPFormatPaths(t *testing.T, root string, source string, want string) {
  t.Helper()
  assertLSPFormatPaths(t, root, source, want)
  assertCLIFormatText(t, root, want)
}

func assertLSPFormatPaths(t *testing.T, root string, source string, want string) {
  t.Helper()
  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))

  actions := runLSPCodeActionsForTest(t, root, uri, `{"only":["source.format"]}`)
  if got := actionCommandsForTest(actions); len(got) != 1 || got[0] != commandFormatDocument {
    t.Fatalf("format actions = %#v, want [%q]", got, commandFormatDocument)
  }
  if got := executeLSPCommandAppliedTextForTest(t, root, uri, commandFormatDocument, source); got != want {
    t.Fatalf("disk format text = %q, want %q", got, want)
  }
  if got := executeLSPFormatBufferAppliedTextForTest(t, root, uri, source, source); got != want {
    t.Fatalf("buffer format text = %q, want %q", got, want)
  }
}

func assertCLIFormatText(t *testing.T, root string, want string) {
  t.Helper()
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != want {
    t.Fatalf("CLI format text = %q, want %q", string(got), want)
  }
}
