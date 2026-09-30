package linthost

import (
  "strings"
  "testing"
)

//
// @evidence contracts/testing.md#behavioral-verification Three named invalid configurations require exact stderr, code two, empty stdout and no rule diagnostic.
// @evidence contracts/testing.md#independent-expectations Literal full command errors independently specify unknown option, incompatible disabled props and malformed regex rejection before any source finding.
// @evidence contracts/testing.md#distinguishing-cases All three configuration failures must suppress a real reportable property source; HonorsPropsConfig owns the successful option-transport counterpart.
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
