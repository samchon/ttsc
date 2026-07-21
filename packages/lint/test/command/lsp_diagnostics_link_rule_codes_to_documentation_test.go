package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

// TestLSPDiagnosticsLinkRuleCodesToDocumentation verifies lsp-diagnostics
// publishes a codeDescription href for built-in rules, derived per family.
//
// The wire field landed empty in #745, so the editor rendered the rule id as
// plain text. This pins the producer end to end through the real subcommand:
// an unprefixed core rule must resolve against eslint.org while a prefixed
// family resolves against its own upstream reference, proving the family
// dispatch runs on the finding's rule name rather than one hardcoded base.
//
//  1. Seed a project violating no-alert (core) and unicorn/no-null (unicorn).
//  2. Run lsp-diagnostics against the file URI.
//  3. Assert each diagnostic carries the documentation URL for its family.
func TestLSPDiagnosticsLinkRuleCodesToDocumentation(t *testing.T) {
  root := seedLintProject(t, `declare function alert(message: string): void;
alert("boom");
export const empty = null;
`)
  seedLintRules(t, root, map[string]string{
    "no-alert":        "error",
    "unicorn/no-null": "error",
  })

  uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "lsp-diagnostics",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
      "--uri", uri,
    })
  })
  if code != 0 || stderr != "" {
    t.Fatalf("lsp-diagnostics mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var result lspDiagnosticsResult
  if err := json.Unmarshal([]byte(stdout), &result); err != nil {
    t.Fatalf("lsp-diagnostics JSON: %v\n%s", err, stdout)
  }

  want := map[string]string{
    "no-alert":        "https://eslint.org/docs/latest/rules/no-alert",
    "unicorn/no-null": "https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-null.md",
  }
  seen := make(map[string]bool, len(want))
  for _, diagnostic := range result.Document {
    href, relevant := want[diagnostic.Code]
    if !relevant {
      continue
    }
    if diagnostic.CodeDescription == nil {
      t.Fatalf("rule %q published no codeDescription: %#v", diagnostic.Code, diagnostic)
    }
    if diagnostic.CodeDescription.Href != href {
      t.Fatalf("rule %q codeDescription.href = %q, want %q",
        diagnostic.Code, diagnostic.CodeDescription.Href, href)
    }
    seen[diagnostic.Code] = true
  }
  for rule := range want {
    if !seen[rule] {
      t.Fatalf("lsp-diagnostics missing rule %q: %#v", rule, result.Document)
    }
  }
}
