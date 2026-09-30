package linthost

import (
  "encoding/json"
  "sort"
  "testing"
)

const unicornImportStyleRuleName = "unicorn/import-style"

// unicornImportStylePolicyOptions mirrors the options fixture upstream's
// test suite applies to every case: four synthetic modules, each named
// after the one style it allows.
const unicornImportStylePolicyOptions = `{
  "checkExportFrom": true,
  "styles": {
    "unassigned": {"unassigned": true, "named": false},
    "default": {"default": true, "named": false},
    "namespace": {"namespace": true, "named": false},
    "named": {"named": true}
  }
}`

type unicornImportStyleFinding struct {
  target  string
  message string
}

// runUnicornImportStyleFindings executes the rule over one source file
// and normalizes every finding to its exact source range and message.
// The helper also locks the structural invariants shared by all cases:
// the rule never offers edits and never reports an invalid range.
func runUnicornImportStyleFindings(t *testing.T, source, optionsJSON string) []unicornImportStyleFinding {
  t.Helper()
  var options json.RawMessage
  if optionsJSON != "" {
    options = json.RawMessage(optionsJSON)
  }
  _, _, findings := runRuleFindingsSnapshot(t, unicornImportStyleRuleName, source, options)
  type positionedFinding struct {
    pos     int
    finding unicornImportStyleFinding
  }
  entries := make([]positionedFinding, 0, len(findings))
  for _, finding := range findings {
    if finding.engineFailure || finding.Severity != SeverityError || finding.Rule != unicornImportStyleRuleName {
      t.Fatalf("unexpected rule in findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("unicorn/import-style must not offer edits: %+v", finding)
    }
    if finding.Pos < 0 || finding.End <= finding.Pos || finding.End > len(source) {
      t.Fatalf("unicorn/import-style returned an invalid source range: %+v", finding)
    }
    entries = append(entries, positionedFinding{
      pos: finding.Pos,
      finding: unicornImportStyleFinding{
        target:  source[finding.Pos:finding.End],
        message: finding.Message,
      },
    })
  }
  sort.SliceStable(entries, func(i, j int) bool {
    return entries[i].pos < entries[j].pos
  })
  normalized := make([]unicornImportStyleFinding, len(entries))
  for index, entry := range entries {
    normalized[index] = entry.finding
  }
  return normalized
}

func assertUnicornImportStyleFindings(
  t *testing.T,
  got []unicornImportStyleFinding,
  want ...unicornImportStyleFinding,
) {
  t.Helper()
  if len(got) != len(want) {
    t.Fatalf("finding count mismatch:\nwant %+v\ngot  %+v", want, got)
  }
  for index := range want {
    if got[index] != want[index] {
      t.Fatalf("finding[%d] mismatch:\nwant %+v\ngot  %+v\nall  %+v", index, want[index], got[index], got)
    }
  }
}

// TestRuleCorpusUnicornImportStyle verifies the corpus fixture: the
// built-in default table flags a namespace import of `node:path`, a
// default import of `node:util`, and a named import of `chalk`.
//
// The fixture runs with no options at all, so it pins the default
// `styles` table (`chalk`/`path` default-only, `util` named-only) and
// the `node:` prefix inheritance through the severity-only corpus path.
//
//  1. Enable unicorn/import-style via expect annotations only.
//  2. Import each default-table module in a disallowed style next to an
//     allowed twin.
//  3. Assert exactly the three annotated lines are reported.
//
// @evidence contracts/testing.md#behavioral-verification The engine compares the annotated default-table namespace/default/named violations with their compliant twins.
// @evidence contracts/testing.md#independent-expectations The supported path/chalk default-only and util named-only policies independently establish the three annotated reports.
// @evidence contracts/testing.md#distinguishing-cases node:path namespace, node:util default and chalk named report; util named, path default and unconfigured fs stay clean.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornImportStyle owns these literal source/options variants as a discoverable Go unit entry; actual engine/config/fix functions execute in one shared Go process without installation, native producer or product child host, retaining named malformed subcases where present.
func TestRuleCorpusUnicornImportStyle(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/import-style.ts", `// Default policies: import path/chalk by default import only, util by named only.
// expect: unicorn/import-style error
import * as path from "node:path";
// expect: unicorn/import-style error
import util from "node:util";
// expect: unicorn/import-style error
import { red } from "chalk";
import { inspect } from "node:util";
import pathDefault from "node:path";
import * as fs from "node:fs";

void path;
void util;
void red;
void inspect;
void pathDefault;
void fs;
`)
}





















