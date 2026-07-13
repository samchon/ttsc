package linthost

import (
  "encoding/json"
  "testing"
)

// TestLSPCommandDiscoveryReportsOwnedCommandsAndKinds verifies the LSP
// discovery verbs expose lint's command surface.
//
// ttscserver decides which executeCommand requests are local only after asking
// each sidecar for command ids and code-action kinds. A typo here would make
// VSCode buttons disappear or forward lint commands to tsgo.
//
// 1. Run `lsp-command-ids` through the real lint dispatcher.
// 2. Run `lsp-code-action-kinds` through the same dispatcher.
// 3. Assert both JSON arrays match the command ids and kinds used by VSCode.
func TestLSPCommandDiscoveryReportsOwnedCommandsAndKinds(t *testing.T) {
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"lsp-command-ids"})
  })
  if code != 0 || !isBenignContributorCollisionWarning(stderr) {
    t.Fatalf("lsp-command-ids mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var commands []string
  if err := json.Unmarshal([]byte(stdout), &commands); err != nil {
    t.Fatalf("lsp-command-ids JSON: %v\n%s", err, stdout)
  }
  if got, want := commands, []string{
    commandLintFixAll,
    commandLintApplySuggestion,
    commandFormatDocument,
  }; !stringSlicesEqual(got, want) {
    t.Fatalf("command ids mismatch: want %#v, got %#v", want, got)
  }

  code, stdout, stderr = captureCommandOutput(t, func() int {
    return run([]string{"lsp-code-action-kinds"})
  })
  if code != 0 || !isBenignContributorCollisionWarning(stderr) {
    t.Fatalf("lsp-code-action-kinds mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var kinds []string
  if err := json.Unmarshal([]byte(stdout), &kinds); err != nil {
    t.Fatalf("lsp-code-action-kinds JSON: %v\n%s", err, stdout)
  }
  if got, want := kinds, []string{"quickfix.ttsc", "source.fixAll.ttsc", "source.format"}; !stringSlicesEqual(got, want) {
    t.Fatalf("code action kinds mismatch: want %#v, got %#v", want, got)
  }
}

func stringSlicesEqual(left []string, right []string) bool {
  if len(left) != len(right) {
    return false
  }
  for i := range left {
    if left[i] != right[i] {
      return false
    }
  }
  return true
}
