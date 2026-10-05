package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckRejectsInvalidNoRestrictedImportsOptionsBeforeLinting
// verifies that the in-process check command rejects a no-restricted-imports
// configuration containing an invalid regex pattern before linting.
//
//  1. Seed a project importing "pkg" and configure two patterns: a valid
//     `group: ["pkg"]` that would report that import, and `regex: "["`.
//  2. Run `check` in this process.
//  3. Assert status 2, empty stdout, the invalid-options and valid-regex
//     messages, and no [no-restricted-imports] diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification The check command rejects an invalid regex configuration before producing any no-restricted-imports diagnostic.
// @evidence contracts/testing.md#independent-expectations The literal [ regex is syntactically invalid; expected invalid-options and valid-regex messages plus status 2 and empty stdout follow configuration failure behavior.
// @evidence contracts/testing.md#distinguishing-cases The configuration pairs a valid `group: ["pkg"]` pattern, which would report the `import value from "pkg"` source if the rule ran, with the invalid `regex: "["` entry; the absence of any [no-restricted-imports] diagnostic therefore shows the whole rule configuration is rejected rather than only the bad entry being dropped. Valid configured command behavior is owned by the adjacent command test.
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
            map[string]any{"group": []string{"pkg"}},
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
