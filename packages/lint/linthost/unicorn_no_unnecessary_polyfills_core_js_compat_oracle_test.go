package linthost

import (
  "encoding/json"
  "testing"
  "time"
)

// TestUnicornNoUnnecessaryPolyfillsCoreJsCompatOracle verifies the
// core-js-compat targets parser and unavailable-module computation against
// every targets shape the generator recorded with the real core-js-compat
// 3.49.0.
//
// This is the heart of the rule: given a targets value it must reproduce the
// exact set (and data.json order) of modules some target still needs. The
// fixture spans node string/number/range targets, browser objects, browser
// queries, `esmodules` true/intersect, engine aliases, and mixed engines, so
// any divergence in alias resolution, lowest-version reduction, or the
// stabilized-proposal filter surfaces here.
//
//  1. Load the recorded targets/unavailable-list pairs.
//  2. Parse each targets value through the same ordered-JSON path the rule uses.
//  3. Assert the computed unavailable-module list matches upstream exactly.
// @evidence contracts/testing.md#behavioral-verification The actual ordered parser, target resolver and compatibility-list computation execute every fixture payload and require its complete list or an error across that chain.
// @evidence contracts/testing.md#independent-expectations Expected lists or errors come from pinned upstream coreJsCompat({targets}).list execution; the Go pipeline supplies only actual results.
// @evidence contracts/testing.md#distinguishing-cases Successful, empty and invalid target populations retain full-list/error assertions; target JSON and case index identify each failing iteration.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsCoreJsCompatOracle owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsCoreJsCompatOracle(t *testing.T) {
  var fixture struct {
    Cases []struct {
      Targets  json.RawMessage `json:"targets"`
      Expected []string        `json:"expected"`
      Error    bool            `json:"error"`
    } `json:"cases"`
  }
  readPolyfillOracle(t, "corejs-compat-cases.json", &fixture)
  if len(fixture.Cases) == 0 {
    t.Fatal("corejs-compat-cases.json has no cases")
  }
  now := func() time.Time { return time.UnixMilli(polyfillOracleFrozenNowMs) }
  for index, testCase := range fixture.Cases {
    // The upstream computation (`coreJsCompat({targets})`) either throws or
    // succeeds; the port distributes that across the JSON parse, the targets
    // parser, and the compat list. An `error` case must fail somewhere in
    // that chain, never produce a list.
    targets, err := browserslistParseOrderedJSON(testCase.Targets)
    var entries []polyfillTargetEntry
    var list []string
    if err == nil {
      entries, err = polyfillParseTargets(targets, ".", now)
    }
    if err == nil {
      list, err = polyfillCompatList(entries)
    }
    if testCase.Error {
      if err == nil {
        t.Fatalf("case %d targets=%s: want error, got list %v", index, testCase.Targets, list)
      }
      continue
    }
    if err != nil {
      t.Fatalf("case %d targets=%s: unexpected error: %v", index, testCase.Targets, err)
    }
    if list == nil {
      list = []string{}
    }
    expected := testCase.Expected
    if expected == nil {
      expected = []string{}
    }
    assertPolyfillStringSlice(t, "targets "+string(testCase.Targets), list, expected)
  }
}
