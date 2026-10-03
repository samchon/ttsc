package linthost

import (
  "strings"
  "testing"
)

// TestCommandCheckRejectsInvalidNoParamReassignOptionsBeforeLinting verifies
// the check command rejects an invalid no-param-reassign option object before
// any source is linted.
//
// A rule that silently dropped a bad option would lint with a policy the user
// did not write. The enabled-props cases supply a reportable property write,
// while the disabled-props case owns rejection of its incompatible ignore list.
// Exact configuration errors and absent rule diagnostics pin validation failure.
//
//  1. Seed a project with a property write on a function parameter.
//  2. For an unknown option, a `props: false` plus ignore-list combination and
//     an uncompilable ignore regex, write the option tuple and run `check`.
//  3. Assert status 2, empty stdout, the exact configuration error and no
//     [no-param-reassign] diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Three named invalid configurations require exact stderr, code two, empty stdout and no rule diagnostic.
// @evidence contracts/testing.md#independent-expectations Literal full command errors independently specify unknown option, incompatible disabled props and malformed regex rejection before any source finding.
// @evidence contracts/testing.md#distinguishing-cases Each subtest supplies the same value.field = 1 source. Unknown-option and invalid-regex cases enable props; the disabled-props case instead owns rejection of props:false combined with an ignore list, without claiming that source must report under disabled props. All require their exact configuration error and no rule diagnostic. HonorsPropsConfig owns the valid option-transport counterpart.
// @evidence contracts/testing.md#execution-ownership TestCommandCheckRejectsInvalidNoParamReassignOptionsBeforeLinting is selected in the shared Go unit population. Each named subtest calls run(check) in-process on a real parsed fixture config with an explicit lint manifest; no consumer install, native artifact build or real host runs.
func TestCommandCheckRejectsInvalidNoParamReassignOptionsBeforeLinting(t *testing.T) {
  cases := []struct {
    name    string
    options map[string]any
    want    string
  }{
    {
      name: "unknown option",
      options: map[string]any{
        "props":      true,
        "unexpected": true,
      },
      want: "@ttsc/lint: invalid options for rule \"no-param-reassign\": unknown option \"unexpected\"\n",
    },
    {
      name: "disabled props with ignore list",
      options: map[string]any{
        "props":                          false,
        "ignorePropertyModificationsFor": []string{"value"},
      },
      want: "@ttsc/lint: invalid options for rule \"no-param-reassign\": ignore options cannot be combined with \"props\" set to false\n",
    },
    {
      name: "invalid regex",
      options: map[string]any{
        "props": true,
        "ignorePropertyModificationsForRegex": []string{
          "[",
        },
      },
      want: "@ttsc/lint: invalid options for rule \"no-param-reassign\": option \"ignorePropertyModificationsForRegex\"[0] must be a valid regular expression: error parsing regexp: missing closing ]: `[`\n",
    },
  }

  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      root := seedLintProject(t, `function mutate(value: any): void {
  value.field = 1;
}
JSON.stringify(mutate);
`)
      seedLintConfig(t, root, map[string]any{
        "rules": map[string]any{
          "no-param-reassign": []any{"error", tc.options},
        },
      })
      code, stdout, stderr := captureCommandOutput(t, func() int {
        return run([]string{
          "check",
          "--cwd", root,
          "--plugins-json", lintManifest(t),
        })
      })
      if code != 2 || stdout != "" || stderr != tc.want || strings.Contains(stderr, "[no-param-reassign]") {
        t.Fatalf("invalid no-param-reassign command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
      }
    })
  }
}
