package linthost

import (
  "bytes"
  "encoding/json"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
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
    if !isBenignContributorCollisionWarning(stderr) {
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
    if !isBenignContributorCollisionWarning(stderr) {
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

// buildLintSidecarBinaryForTest builds the real @ttsc/lint sidecar (the
// ./plugin main package) into a temp binary and returns its path.
//
// The scratch layout produced by scripts/test-go-lint.cjs flattens this test
// into scratch/linthost/<file>.go, so runtime.Caller points there and the
// scratch module root (which contains plugin/main.go and the go.work resolving
// the shims) is one directory up. Mirrors the go-build-into-tempdir idiom in
// packages/ttsc/test/ttscserver/helpers_test.go.
//
// One wrinkle is unique to the lint scratch layout: copyGoTestsFlat flattens
// EVERY .go file under packages/lint/test/ into scratch/linthost/, including
// the lone helper that is not named *_test.go
// (test/rules/control-flow/no_magic_numbers_test_other.go). A plain
// `go build ./plugin` would compile that helper as part of package linthost in
// a non-test build, where the *_test.go symbols it references (e.g.
// assertRuleCorpusCase) do not exist — breaking the build. That is purely an
// artifact of the test materialization, not a real ttsc defect. To build the
// production binary cleanly, this helper reconstructs the scratch module into a
// fresh temp dir and drops the flattened test files from linthost/ (identified
// by matching basenames under the real packages/lint/test/ tree, located via
// the runner-provided TTSC_TTSX_BINARY).
func buildLintSidecarBinaryForTest(t *testing.T) string {
  t.Helper()
  _, thisFile, _, ok := runtime.Caller(0)
  if !ok {
    t.Fatal("runtime.Caller(0) returned ok=false; cannot locate scratch module root")
  }
  scratchRoot := filepath.Dir(filepath.Dir(thisFile))

  buildRoot := t.TempDir()
  if err := copyTree(scratchRoot, buildRoot); err != nil {
    t.Fatalf("copy scratch module for build: %v", err)
  }
  for name := range flattenedLintTestFilenames(t) {
    _ = os.Remove(filepath.Join(buildRoot, "linthost", name))
  }
  // The scratch go.work `use`s the scratch module by its absolute path; after
  // copying, repoint that entry at buildRoot so the build consumes the
  // stripped-down linthost/ here, not the polluted original. The other entries
  // (packages/ttsc + shims) are absolute paths outside the scratch tree and
  // stay valid.
  retargetGoWorkRoot(t, filepath.Join(buildRoot, "go.work"), scratchRoot, buildRoot)

  bin := filepath.Join(t.TempDir(), "ttsc-lint")
  if filepath.Separator == '\\' {
    bin += ".exe"
  }
  build := exec.Command("go", "build", "-o", bin, "./plugin")
  build.Dir = buildRoot
  if output, err := build.CombinedOutput(); err != nil {
    t.Fatalf("go build ./plugin failed: %v\n%s", err, output)
  }
  return bin
}

// flattenedLintTestFilenames returns the basenames of every .go file under the
// real packages/lint/test/ tree. These are exactly the files copyGoTestsFlat
// pours into scratch/linthost/, so removing them before a non-test build leaves
// only the genuine linthost library sources. The real test directory is located
// relative to TTSC_TTSX_BINARY (.../packages/ttsc/lib/launcher/ttsx.js), which
// scripts/test-go-lint.cjs always exports to the go test child.
func flattenedLintTestFilenames(t *testing.T) map[string]struct{} {
  t.Helper()
  ttsx := os.Getenv("TTSC_TTSX_BINARY")
  if strings.TrimSpace(ttsx) == "" {
    t.Skip("TTSC_TTSX_BINARY not set; run via scripts/test-go-lint.cjs to build the real sidecar")
  }
  // .../packages/ttsc/lib/launcher/ttsx.js -> repo root is four dirs up.
  repoRoot := filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(filepath.Dir(ttsx)))))
  testDir := filepath.Join(repoRoot, "packages", "lint", "test")
  out := map[string]struct{}{}
  err := filepath.WalkDir(testDir, func(path string, d os.DirEntry, err error) error {
    if err != nil {
      return err
    }
    if !d.IsDir() && strings.HasSuffix(d.Name(), ".go") {
      out[d.Name()] = struct{}{}
    }
    return nil
  })
  if err != nil {
    t.Fatalf("walk lint test dir %s: %v", testDir, err)
  }
  return out
}

// retargetGoWorkRoot rewrites the `use` entry that points at oldRoot in the
// go.work at path so it points at newRoot instead. scripts/test-go-lint.cjs
// writes the scratch module entry as the self-relative "." (absolute temp
// paths fail Go's workspace membership check on Windows), which after
// copyTree already points at the copied module — nothing to rewrite then.
// An absolute oldRoot entry (forward slashes, see the runner) is still
// retargeted for older scratch layouts.
func retargetGoWorkRoot(t *testing.T, path, oldRoot, newRoot string) {
  t.Helper()
  data, err := os.ReadFile(path)
  if err != nil {
    t.Fatalf("read go.work: %v", err)
  }
  text := string(data)
  oldSlash := filepath.ToSlash(oldRoot)
  newSlash := filepath.ToSlash(newRoot)
  replaced := strings.ReplaceAll(text, oldSlash, newSlash)
  if replaced == text {
    if hasSelfRelativeGoWorkUse(text) {
      return
    }
    t.Fatalf("go.work did not reference scratch root %q to retarget:\n%s", oldSlash, text)
  }
  if err := os.WriteFile(path, []byte(replaced), 0o644); err != nil {
    t.Fatalf("write go.work: %v", err)
  }
}

// hasSelfRelativeGoWorkUse reports whether the go.work text contains a
// self-relative `use` entry ("." on its own line inside the use block).
func hasSelfRelativeGoWorkUse(text string) bool {
  for _, line := range strings.Split(text, "\n") {
    if strings.TrimSpace(line) == "." {
      return true
    }
  }
  return false
}

// copyTree recursively copies the file tree at src into dst, preserving regular
// files and directories. Symlinks (the scratch go.work points at shim modules
// by absolute path, so none are needed inside the tree) are skipped.
func copyTree(src, dst string) error {
  return filepath.WalkDir(src, func(path string, d os.DirEntry, err error) error {
    if err != nil {
      return err
    }
    rel, relErr := filepath.Rel(src, path)
    if relErr != nil {
      return relErr
    }
    target := filepath.Join(dst, rel)
    if d.IsDir() {
      return os.MkdirAll(target, 0o755)
    }
    if !d.Type().IsRegular() {
      return nil
    }
    data, readErr := os.ReadFile(path)
    if readErr != nil {
      return readErr
    }
    if mkErr := os.MkdirAll(filepath.Dir(target), 0o755); mkErr != nil {
      return mkErr
    }
    return os.WriteFile(target, data, 0o644)
  })
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
  runErr := cmd.Run()
  code := 0
  if exit, ok := runErr.(*exec.ExitError); ok {
    code = exit.ExitCode()
  } else if runErr != nil {
    t.Fatalf("sidecar failed before exit code: %v\nstderr=%q", runErr, stderr.String())
  }
  return code, stdout.String(), stderr.String()
}
