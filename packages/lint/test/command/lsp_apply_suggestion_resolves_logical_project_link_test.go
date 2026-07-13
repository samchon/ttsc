package linthost

import (
  "encoding/json"
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

// TestLSPApplySuggestionResolvesLogicalProjectLink verifies suggestion
// discovery and execution use the same physical project boundary while the
// returned WorkspaceEdit keeps the editor's logical document URI.
//
// NativePluginSource runs the lint sidecar from PhysicalProjectRoot but keeps
// the logical URI supplied by an editor that opened a symlink or junction.
// Code-action discovery and execution must resolve both paths consistently
// without rejecting the action, reading a different file, or relaxing the
// outside-project and node_modules guards.
//
//  1. Expose one physical project through a logical directory link.
//  2. Discover and execute a manual suggestion for the logical URI.
//  3. Assert the edit is keyed by that URI and leaves the physical file alone.
//  4. Reuse the signed selection with outside and node_modules URIs and assert
//     both command boundaries still fail closed.
func TestLSPApplySuggestionResolvesLogicalProjectLink(t *testing.T) {
  source := "let value: (\"one\") = \"one\";\nJSON.stringify(value);\n"
  physicalRoot := seedLintProject(t, source)
  seedLintConfig(t, physicalRoot, map[string]any{
    "rules": map[string]any{"typescript/prefer-as-const": "error"},
  })

  logicalRoot := filepath.Join(t.TempDir(), "project-link")
  createLSPDirectoryLinkForTest(t, physicalRoot, logicalRoot)
  logicalFile := filepath.Join(logicalRoot, "src", "main.ts")
  logicalURI := lintTestFileURI(t, logicalFile)
  logicalOptions := &lspCommandOptions{cwd: physicalRoot, uri: logicalURI}
  if lspProjectTargetOutsideCwd(logicalOptions) || lspProjectTargetHasSegment(logicalOptions, "node_modules") {
    t.Fatalf("logical project link was classified outside the source project")
  }

  actions := runLSPCodeActionsForRangeForTest(
    t,
    physicalRoot,
    logicalURI,
    `{"start":{"line":0,"character":0},"end":{"line":0,"character":40}}`,
    `{"only":["quickfix"]}`,
  )
  if len(actions) != 1 || actions[0].Command == nil ||
    actions[0].Command.Command != commandLintApplySuggestion {
    t.Fatalf("logical-link quick fixes = %#v", actions)
  }

  command := actions[0].Command
  edit := executeLSPCommandEditWithArgumentsForTest(
    t,
    physicalRoot,
    command.Command,
    command.Arguments,
    lintManifest(t),
  )
  if edit == nil || len(edit.Changes) != 1 || len(edit.Changes[logicalURI]) == 0 {
    t.Fatalf("logical-link suggestion edit = %#v", edit)
  }
  if _, leaked := edit.Changes[lintTestFileURI(t, filepath.Join(physicalRoot, "src", "main.ts"))]; leaked {
    t.Fatalf("WorkspaceEdit replaced logical URI with physical path: %#v", edit.Changes)
  }
  rewritten := applyLSPWorkspaceEditForTest(t, source, edit.Changes[logicalURI])
  expected := "let value = \"one\" as const;\nJSON.stringify(value);\n"
  if rewritten != expected {
    t.Fatalf("logical-link suggestion mismatch:\nwant %q\ngot  %q", expected, rewritten)
  }
  assertFileText(t, filepath.Join(physicalRoot, "src", "main.ts"), source)

  outsideRoot := t.TempDir()
  outside := filepath.Join(outsideRoot, "outside.ts")
  writeFile(t, outside, source)
  outsideLink := filepath.Join(physicalRoot, "outside-link")
  createLSPDirectoryLinkForTest(t, outsideRoot, outsideLink)
  outsideURI := lintTestFileURI(t, filepath.Join(outsideLink, "outside.ts"))
  outsideArguments := replaceLSPCommandURIForTest(
    t,
    command.Arguments,
    outsideURI,
  )
  if !lspProjectTargetOutsideCwd(&lspCommandOptions{cwd: physicalRoot, uri: outsideURI}) {
    t.Fatal("linked outside target was classified inside the source project")
  }
  code, stdout, stderr := runLSPApplySuggestionForTest(t, physicalRoot, outsideArguments)
  if code != 2 || stdout != "" || !strings.Contains(stderr, "outside cwd") {
    t.Fatalf("outside suggestion boundary: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }

  dependency := filepath.Join(physicalRoot, "node_modules", "demo", "index.ts")
  writeFile(t, dependency, source)
  dependencyLink := filepath.Join(physicalRoot, "dependency-link")
  createLSPDirectoryLinkForTest(t, filepath.Dir(dependency), dependencyLink)
  dependencyURI := lintTestFileURI(t, filepath.Join(dependencyLink, "index.ts"))
  dependencyArguments := replaceLSPCommandURIForTest(
    t,
    command.Arguments,
    dependencyURI,
  )
  if !lspProjectTargetHasSegment(&lspCommandOptions{cwd: physicalRoot, uri: dependencyURI}, "node_modules") {
    t.Fatal("linked dependency target hid its node_modules boundary")
  }
  code, stdout, stderr = runLSPApplySuggestionForTest(t, physicalRoot, dependencyArguments)
  if code != 0 || strings.TrimSpace(stdout) != "null" || stderr != "" {
    t.Fatalf("node_modules suggestion boundary: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}

func createLSPDirectoryLinkForTest(t *testing.T, target string, link string) {
  t.Helper()
  if err := os.Symlink(target, link); err == nil {
    return
  } else if runtime.GOOS != "windows" {
    t.Skipf("directory symlink unavailable: %v", err)
  }
  if output, err := exec.Command("cmd", "/c", "mklink", "/J", link, target).CombinedOutput(); err != nil {
    t.Skipf("directory link unavailable: %v: %s", err, output)
  }
}

func replaceLSPCommandURIForTest(t *testing.T, arguments []json.RawMessage, uri string) []json.RawMessage {
  t.Helper()
  replaced := append([]json.RawMessage(nil), arguments...)
  raw, err := json.Marshal(uri)
  if err != nil {
    t.Fatal(err)
  }
  replaced[0] = raw
  return replaced
}

func runLSPApplySuggestionForTest(t *testing.T, root string, arguments []json.RawMessage) (int, string, string) {
  t.Helper()
  raw, err := json.Marshal(arguments)
  if err != nil {
    t.Fatal(err)
  }
  return captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-execute-command",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
      "--command", commandLintApplySuggestion,
      "--arguments-json", string(raw),
    })
  })
}
