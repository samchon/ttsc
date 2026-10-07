package linthost

import (
  "sort"
  "testing"
)

const unicornNoUnnecessaryPolyfillsRuleName = "unicorn/no-unnecessary-polyfills"

const (
  polyfillMessageBuiltIn = "Use built-in instead."
)

func polyfillCoreJsMessage(module string) string {
  return "All polyfilled features imported from `" + module +
    "` are available as built-ins. Use the built-ins instead."
}

// runNoUnnecessaryPolyfills runs the rule over one source file with the given
// targets options and returns each finding's message in source order. It also
// locks the structural contract shared by every case: the rule never offers an
// automatic edit and never reports an out-of-range span.
func runNoUnnecessaryPolyfills(t *testing.T, source, optionsJSON string) []string {
  t.Helper()
  var options []byte
  if optionsJSON != "" {
    options = []byte(optionsJSON)
  }
  _, _, findings := runRuleFindingsSnapshot(t, unicornNoUnnecessaryPolyfillsRuleName, source, options)
  type positioned struct {
    pos     int
    message string
  }
  entries := make([]positioned, 0, len(findings))
  for _, finding := range findings {
    if finding.engineFailure || finding.Severity != SeverityError {
      t.Fatalf("expected a rule error, not a host failure or different severity: %+v", finding)
    }
    if finding.Rule != unicornNoUnnecessaryPolyfillsRuleName {
      t.Fatalf("unexpected rule in findings: %+v", finding)
    }
    if len(finding.Fix) != 0 || len(finding.Suggestions) != 0 {
      t.Fatalf("%s must not offer edits: %+v", unicornNoUnnecessaryPolyfillsRuleName, finding)
    }
    if finding.Pos < 0 || finding.End <= finding.Pos || finding.End > len(source) {
      t.Fatalf("%s returned an invalid source range: %+v (len=%d)", unicornNoUnnecessaryPolyfillsRuleName, finding, len(source))
    }
    entries = append(entries, positioned{pos: finding.Pos, message: finding.Message})
  }
  sort.SliceStable(entries, func(i, j int) bool { return entries[i].pos < entries[j].pos })
  messages := make([]string, len(entries))
  for i, entry := range entries {
    messages[i] = entry.message
  }
  return messages
}

func assertPolyfillClean(t *testing.T, source, optionsJSON string) {
  t.Helper()
  if got := runNoUnnecessaryPolyfills(t, source, optionsJSON); len(got) != 0 {
    t.Fatalf("want no findings for %q (options %s), got %v", source, optionsJSON, got)
  }
}

func assertPolyfillReports(t *testing.T, source, optionsJSON, wantMessage string) {
  t.Helper()
  got := runNoUnnecessaryPolyfills(t, source, optionsJSON)
  if len(got) != 1 || got[0] != wantMessage {
    t.Fatalf("want single finding %q for %q (options %s), got %v", wantMessage, source, optionsJSON, got)
  }
}

// TestUnicornNoUnnecessaryPolyfillsUpstreamValidTargets verifies the authored
// clean cases whose targets come from the targets option: the rule
// stays silent when at least one targeted runtime still lacks the imported
// feature, when the specifier is not a polyfill, and when the specifier is not
// a resolvable string literal.
//
// These include negative twins of the sibling reporting table; matching imports at
// tighter targets are reported there, so keeping both pins the availability
// boundary rather than a single direction.
//
//  1. Feed each specifier the authored targets option.
//  2. Assert zero findings.
//  3. Cover multi-feature core-js entries, esnext-still-needed features, alias
//     modules whose mapped entry keeps unavailable features, and the
//     empty/`null`/argument-less specifier shapes.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule execution checks the complete authored clean matrix for zero findings, detecting overreporting of needed polyfills and unsupported source shapes.
// @evidence contracts/testing.md#independent-expectations Authored clean inputs and the supported compatibility/source-matching contracts establish silence independently of Go output.
// @evidence contracts/testing.md#distinguishing-cases The authored needed-feature, unknown-module and unmatched-source controls remain; UpstreamInvalidTargets owns redundant-feature counterparts and exact messages.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsUpstreamValidTargets owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsUpstreamValidTargets(t *testing.T) {
  cases := []struct {
    source  string
    options string
  }{
    {`require("object-assign")`, `{"targets":{"node":"0.1.0"}}`},
    {`import regexpEscape from "regexp.escape"`, `{"targets":{"node":"18"}}`},
    {`require("core-js/full/regexp/escape")`, `{"targets":{"node":"18"}}`},
    {`import withResolvers from "promise.withresolvers"`, `{"targets":{"node":"20.15.0"}}`},
    {`import arrayFromAsync from "array-from-async"`, `{"targets":{"node":"21"}}`},
    {`require("this-is-not-a-polyfill")`, `{"targets":{"node":"0.1.0"}}`},
    {`import assign from "object-assign"`, `{"targets":{"node":"0.1.0"}}`},
    {`import("object-assign")`, `{"targets":{"node":"0.1.0"}}`},
    {`require("object-assign")`, `{"targets":"node <4"}`},
    {`require("object-assign")`, `{"targets":"node >3"}`},
    {`require()`, `{"targets":"node >3"}`},
    {`import("")`, `{"targets":"node >3"}`},
    {`import(null)`, `{"targets":"node >3"}`},
    {`require(null)`, `{"targets":"node >3"}`},
    {`require("" )`, `{"targets":"node >3"}`},
    {`import "core-js/stable"`, `{"targets":[">0.2%","iOS 14","not dead","not op_mini all"]}`},
    {`require("core-js/features/typed-array")`, `{"targets":"node >16"}`},
    {`require("core-js/stable/promise")`, `{"targets":"node >15"}`},
    {`import "core-js/stable"`, `{"targets":"node >20"}`},
    {`require("core-js-pure/stable/symbol")`, `{"targets":"node >15"}`},
    {`require("typed-array-float64-array-polyfill")`, `{"targets":"node 17"}`},
    {`require("core-js/features/regexp/escape")`, `{"targets":{"node":"18"}}`},
    {`import "core-js/actual/array/to-spliced"`, `{"targets":{"node":"18"}}`},
    {`import "core-js/full/array/to-spliced"`, `{"targets":{"node":"18"}}`},
    {`import "core-js/es/array/to-spliced"`, `{"targets":{"node":"18"}}`},
    {`import "core-js/stable/array/to-spliced"`, `{"targets":{"node":"18"}}`},
  }
  for _, testCase := range cases {
    assertPolyfillClean(t, testCase.source, testCase.options)
  }
}
