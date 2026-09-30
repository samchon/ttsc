package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckRejectsInvalidNoRestrictedImportsOptionsBeforeLinting verifies The check command rejects an invalid regex configuration before producing any no-restricted-imports diagnostic.
//
// Pins the distinct option, syntax or failure branch represented by this fixture.
//
// 1. Supply the authored source and configuration inputs.
// 2. Run the owning engine or command operation in this process.
// 3. Compare the literal findings, messages or failure state below.
//
// @evidence contracts/testing.md#behavioral-verification The check command rejects an invalid regex configuration before producing any no-restricted-imports diagnostic.
// @evidence contracts/testing.md#independent-expectations The literal [ regex is syntactically invalid; expected invalid-options and valid-regex messages plus status 2 and empty stdout follow configuration failure behavior.
// @evidence contracts/testing.md#distinguishing-cases A source that would otherwise be linted ensures failed validation cannot enter dispatch; valid configured command behavior is owned by the adjacent command test.
// @evidence contracts/testing.md#execution-ownership seedLintProject and seedLintConfig materialize the invalid-regex fixture. captureCommandOutput directly calls run(check, --cwd, --plugins-json); this Test owns the configuration failure and absence of lint diagnostics, without launching a CLI child.
func TestCommandCheckRejectsInvalidNoRestrictedImportsOptionsBeforeLinting(t *testing.T) {
  root := seedLintProject(t, `import value from "pkg";
JSON.stringify(value);
`)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{
      "no-restricted-imports": []any{
        "error",
        map[string]any{
          "patterns": []any{
            map[string]any{"regex": "["},
          },
        },
      },
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" ||
    !strings.Contains(stderr, `@ttsc/lint: invalid options for rule "no-restricted-imports"`) ||
    !strings.Contains(stderr, `option "regex" must be a valid regular expression`) ||
    strings.Contains(stderr, "[no-restricted-imports]") {
    t.Fatalf("invalid no-restricted-imports command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
