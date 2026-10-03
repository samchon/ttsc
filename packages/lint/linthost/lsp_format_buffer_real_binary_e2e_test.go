//go:build e2e

package linthost

import (
  "bytes"
  "encoding/json"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
)

// TestLSPFormatBufferRealBinaryE2E exercises the REAL compiled @ttsc/lint
// sidecar binary over the formatOnSave --content-stdin path, end to end.
//
// Unlike the sibling in-process tests in
// lsp_format_buffer_in_memory_test.go (which call run(...) directly inside the
// test process), this test builds the actual `./plugin` main package into a
// temp binary and invokes it as a child process using the EXACT argument
// vector + stdin the ttscserver proxy sends from
// packages/ttsc/internal/lspserver/lsp_native_plugin_source.go
// (ExecuteCommandWithContent + runWithStdin):
//
//  lsp-execute-command
//    --cwd=<root>
//    --tsconfig=<tsconfig>
//    --plugins-json=<manifest>
//    --command=ttsc.format.document
//    --arguments-json=[<file-uri>]
//    --content-stdin
//
// with the full dirty buffer text piped to the child's stdin. This validates
// the real proxy -> sidecar binary contract, not just the in-process function.
//
// The on-disk source file is deliberately seeded with DIFFERENT, already
// well-formatted text from the buffer, so that if the binary ever wrongly read
// the file from disk the WorkspaceEdit would echo disk and the assertion would
// fail. The test also re-reads the file afterward to prove it is byte-for-byte
// unchanged.
//
// @evidence contracts/testing.md#behavioral-verification Exercises the compiled lint plugin command with proxy-shaped argv and dirty buffer stdin; asserts successful exit, empty stderr, exactly one logical-URI edit containing formatted buffer text, literal null for a clean buffer, and unchanged disk text, distinguishing the named lost connection or changed behavior from valid execution.
// @evidence contracts/testing.md#independent-expectations Literal buffer/disk texts differ deliberately, and the format/semi contract adds the missing semicolon.
// @evidence contracts/testing.md#distinguishing-cases This case owns dirty stdin cannot be replaced by disk content and an already formatted buffer returns no edit; portable rule decisions remain in the shared Go unit population.
// @evidence contracts/testing.md#execution-ownership The lint E2E entry calls nativeLintConnections, which selects TestLSPFormatBufferRealBinaryE2E by exact name through GoBoundary.run with the e2e build tag in packages/lint/linthost. Go test retains this entry and its subcase failure identities; ordinary Go unit execution does not select this tagged file.
func TestLSPFormatBufferRealBinaryE2E(t *testing.T) {
  bin := buildLintSidecarBinaryForTest(t)

  // Disk holds DIFFERENT, already-formatted text from the buffer. The format
  // rule under test is `format/semi` (require semicolons). The buffer is
  // missing its trailing semicolon; disk already has one and uses a different
  // identifier, so a disk read would be detectable.
  diskContent := "const onDisk = 999;\n"
  root := seedLintProject(t, diskContent)
  seedLintConfig(t, root, map[string]any{
    "format": map[string]any{},
  })
  tsconfig := filepath.Join(root, "tsconfig.json")
  file := filepath.Join(root, "src", "main.ts")
  uri := lintTestFileURI(t, file)

  // Case 1: dirty buffer (missing semicolon) -> WorkspaceEdit whose newText is
  // the BUFFER formatted (semicolon added), never the on-disk text.
  t.Run("dirty buffer formats from stdin, not disk", func(t *testing.T) {
    buffer := "const x = 1\n"
    want := "const x = 1;\n"

    code, stdout, stderr := runLintSidecarFormatBuffer(t, bin, root, tsconfig, uri, buffer)
    if code != 0 {
      t.Fatalf("sidecar exit code = %d, want 0; stdout=%q stderr=%q", code, stdout, stderr)
    }
    if stderr != "" {
      t.Fatalf("unexpected sidecar stderr: %q", stderr)
    }

    var edit lspWorkspaceEdit
    if err := json.Unmarshal([]byte(stdout), &edit); err != nil {
      t.Fatalf("parse WorkspaceEdit JSON: %v\nstdout=%q", err, stdout)
    }
    edits := edit.Changes[uri]
    if len(edits) != 1 {
      t.Fatalf("want exactly one text edit for %s, got %d (%+v)", uri, len(edits), edit.Changes)
    }
    if edits[0].NewText != want {
      t.Fatalf("WorkspaceEdit newText mismatch:\nwant %q (buffer formatted)\ngot  %q", want, edits[0].NewText)
    }
    if edits[0].NewText == diskContent {
      t.Fatalf("WorkspaceEdit echoed on-disk content %q; binary wrongly read disk instead of stdin buffer", diskContent)
    }
  })

  // Case 2: already-formatted buffer -> no-op. workspaceEditForFullDocument
  // returns nil when original == next, and writeJSON(nil) emits literal
  // `null`, which the proxy decodes as "no edit".
  t.Run("already-formatted buffer is a no-op null edit", func(t *testing.T) {
    buffer := "const y = 2;\n"

    code, stdout, stderr := runLintSidecarFormatBuffer(t, bin, root, tsconfig, uri, buffer)
    if code != 0 {
      t.Fatalf("sidecar exit code = %d, want 0; stdout=%q stderr=%q", code, stdout, stderr)
    }
    if stderr != "" {
      t.Fatalf("unexpected sidecar stderr: %q", stderr)
    }
    if got := strings.TrimSpace(stdout); got != "null" {
      t.Fatalf("already-formatted buffer should yield null no-op edit, got %q", got)
    }
  })

  // The on-disk file must remain byte-for-byte unchanged after both calls: the
  // --content-stdin path never reads or writes the target file.
  disk, err := os.ReadFile(file)
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(disk) != diskContent {
    t.Fatalf("in-memory format mutated disk:\nwant %q\ngot  %q", diskContent, string(disk))
  }
}

// buildLintSidecarBinaryForTest builds the owning package's actual ./plugin
// producer once for the dirty and clean buffer requests. Go test runs this
// package from packages/lint/linthost, whose parent is the module root. The
// existing workspace and object cache remain authoritative; no source tree or
// workspace is flattened, copied or rewritten.
func buildLintSidecarBinaryForTest(t *testing.T) string {
  t.Helper()
  packageRoot, err := os.Getwd()
  if err != nil {
    t.Fatalf("read Go test package working directory: %v", err)
  }
  bin := filepath.Join(t.TempDir(), "ttsc-lint")
  if filepath.Separator == '\\' {
    bin += ".exe"
  }
  goBinary := os.Getenv("TTSC_GO_BINARY")
  if goBinary == "" {
    goBinary = "go"
  }
  build := exec.Command(goBinary, "build", "-trimpath", "-o", bin, "./plugin")
  build.Dir = filepath.Dir(packageRoot)
  observation := newLintTraceInvocation()
  lower := recordLintCommandAttempt(observation, build, "lint-sidecar-build")
  output, err := build.CombinedOutput()
  recordLintCommandResult(observation, build, "lint-sidecar-build", "CombinedOutput", lower, err)
  if err != nil {
    t.Fatalf("go build ./plugin failed: %v\n%s", err, output)
  }
  observeLintCommandArtifact(observation, bin, "lint-sidecar-build", "lint-sidecar-artifact")
  return bin
}

// runLintSidecarFormatBuffer invokes the built sidecar binary with the EXACT
// argument vector + stdin the ttscserver proxy sends for a formatOnSave
// document format, and returns the child's exit code, stdout, and stderr.
func runLintSidecarFormatBuffer(t *testing.T, bin, root, tsconfig, uri, buffer string) (int, string, string) {
  t.Helper()
  argsJSON, err := json.Marshal([]string{uri})
  if err != nil {
    t.Fatal(err)
  }
  cmd := exec.Command(
    bin,
    "lsp-execute-command",
    "--cwd="+root,
    "--tsconfig="+tsconfig,
    "--plugins-json="+lintManifest(t),
    "--command="+commandFormatDocument,
    "--arguments-json="+string(argsJSON),
    "--content-stdin",
  )
  cmd.Dir = root
  cmd.Env = os.Environ()
  cmd.Stdin = strings.NewReader(buffer)
  var stdout, stderr bytes.Buffer
  cmd.Stdout = &stdout
  cmd.Stderr = &stderr
  observation := newLintTraceInvocation()
  lower := recordLintCommandAttempt(observation, cmd, "lint-sidecar-format-buffer")
  runErr := cmd.Run()
  recordLintCommandResult(observation, cmd, "lint-sidecar-format-buffer", "Run", lower, runErr)
  code := 0
  if exit, ok := runErr.(*exec.ExitError); ok {
    code = exit.ExitCode()
  } else if runErr != nil {
    t.Fatalf("sidecar failed before exit code: %v\nstderr=%q", runErr, stderr.String())
  }
  return code, stdout.String(), stderr.String()
}

