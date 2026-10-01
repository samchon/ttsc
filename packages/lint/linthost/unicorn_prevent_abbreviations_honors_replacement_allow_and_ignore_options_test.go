package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornPreventAbbreviationsHonorsReplacementAllowAndIgnoreOptions verifies that the engine/fixer checks one custom cmd report and the authored complete output.
//
// Explicit dictionary replacement, allowList and ignore policies independently leave err/ignoredCmd/allowedCmd unchanged.
//
// @evidence contracts/testing.md#behavioral-verification The engine/fixer checks one custom cmd report and the authored complete output.
// @evidence contracts/testing.md#independent-expectations Explicit dictionary replacement, allowList and ignore policies independently leave err/ignoredCmd/allowedCmd unchanged.
// @evidence contracts/testing.md#distinguishing-cases Only cmd becomes command; omitted defaults, regex ignore and exact allow-list names stay clean.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsHonorsReplacementAllowAndIgnoreOptions owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsHonorsReplacementAllowAndIgnoreOptions(t *testing.T) {
  source := "const err = 1;\nconst cmd = 2;\nconst ignoredCmd = 3;\nconst allowedCmd = 4;\nvoid [err, cmd, ignoredCmd, allowedCmd];\n"
  options := `{
    "extendDefaultReplacements": false,
    "replacements": {"cmd": {"command": true}},
    "allowList": {"allowedCmd": true},
    "ignore": ["^ignored"]
  }`
  _, _, findings := runRuleFindingsSnapshot(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    json.RawMessage(options),
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornPreventAbbreviationsRuleName, findings)
  if len(findings) != 1 || !strings.Contains(findings[0].Message, "`cmd`") {
    t.Fatalf("expected only custom cmd diagnostic, got %+v", findings)
  }
  assertFixSnapshotWithOptions(
    t,
    unicornPreventAbbreviationsRuleName,
    source,
    options,
    "const err = 1;\nconst command = 2;\nconst ignoredCmd = 3;\nconst allowedCmd = 4;\nvoid [err, command, ignoredCmd, allowedCmd];\n",
  )
}
