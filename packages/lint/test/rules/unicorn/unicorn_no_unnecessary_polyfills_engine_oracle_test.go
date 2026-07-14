package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
  "time"
)

// The upstream resolvers `unicorn/no-unnecessary-polyfills` depends on
// (browserslist's query engine, core-js-compat's targets/compat computation,
// and the rule's own pattern-table construction) are ported by hand in
// `polyfill_browserslist.go`, `polyfill_corejs.go`, and the pattern builder in
// `polyfill_corejs.go`. The three fixtures under
// `test/testdata/polyfills/` were recorded by executing the real pinned
// upstream packages inside `tools/polyfilldata/generate.mjs`, so these oracle
// tests pin every port byte-for-byte against upstream output instead of
// against whatever the Go code happens to emit.

const polyfillOracleFrozenNowMs = 1767744000000

func readPolyfillOracle(t *testing.T, name string, out interface{}) {
  t.Helper()
  fixturePath := filepath.Join("..", "test", "testdata", "polyfills", name)
  data, err := os.ReadFile(fixturePath)
  if err != nil {
    t.Fatalf("read %s: %v", fixturePath, err)
  }
  if err := json.Unmarshal(data, out); err != nil {
    t.Fatalf("decode %s: %v", fixturePath, err)
  }
}

func assertPolyfillStringSlice(t *testing.T, label string, got, want []string) {
  t.Helper()
  if len(got) != len(want) {
    t.Fatalf("%s: length mismatch: want %d, got %d\nwant %v\ngot  %v", label, len(want), len(got), want, got)
  }
  for i := range want {
    if got[i] != want[i] {
      t.Fatalf("%s[%d]: want %q, got %q\nwant %v\ngot  %v", label, i, want[i], got[i], want, got)
    }
  }
}

// TestUnicornNoUnnecessaryPolyfillsBrowserslistQueryOracle verifies the
// browserslist query-engine port against every query the generator resolved
// with the real browserslist 4.28.6 at a frozen clock.
//
// browserslist queries fan out through dozens of selectors (usage, version
// ranges, `and`/`or`/`not` composition, aliases, `dead`, `defaults`), and a
// single off-by-one in version ordering silently changes which polyfills a
// project is told it can drop. Pinning the full resolved browser list per
// query catches any selector drift.
//
//  1. Load the recorded query/result pairs and the clock they were frozen at.
//  2. Resolve each query string or query array through the Go engine.
//  3. Assert the resolved browser list matches upstream exactly and in order.
func TestUnicornNoUnnecessaryPolyfillsBrowserslistQueryOracle(t *testing.T) {
  var fixture struct {
    FrozenNowMs int64 `json:"frozenNowMs"`
    Cases       []struct {
      Query    json.RawMessage `json:"query"`
      Expected []string        `json:"expected"`
      Error    bool            `json:"error"`
    } `json:"cases"`
  }
  readPolyfillOracle(t, "browserslist-cases.json", &fixture)
  if len(fixture.Cases) == 0 {
    t.Fatal("browserslist-cases.json has no cases")
  }
  now := func() time.Time { return time.UnixMilli(fixture.FrozenNowMs) }
  for index, testCase := range fixture.Cases {
    queries := decodePolyfillQueries(t, testCase.Query)
    got, err := browserslistResolve(queries, true, browserslistOpts{now: now})
    if testCase.Error {
      if err == nil {
        t.Fatalf("case %d query=%s: want resolve error, got %v", index, testCase.Query, got)
      }
      continue
    }
    if err != nil {
      t.Fatalf("case %d query=%s: resolve error: %v", index, testCase.Query, err)
    }
    assertPolyfillStringSlice(t, "query "+string(testCase.Query), got, testCase.Expected)
  }
}

func decodePolyfillQueries(t *testing.T, raw json.RawMessage) []string {
  t.Helper()
  var single string
  if err := json.Unmarshal(raw, &single); err == nil {
    return []string{single}
  }
  var many []string
  if err := json.Unmarshal(raw, &many); err != nil {
    t.Fatalf("query %s is neither string nor []string: %v", raw, err)
  }
  return many
}

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

// TestUnicornNoUnnecessaryPolyfillsPatternTableOracle verifies the rule's
// module-level pattern/token table construction against the table upstream
// builds from the same pinned core-js-compat data and change-case 5.4.4.
//
// The table drives which import specifiers are even considered a polyfill of a
// given feature; a wrong regex or a missing camelCase token would make the
// rule miss (or over-match) whole families of packages. The fixture records
// every feature's compiled pattern source and token set in construction order.
//
//  1. Load the recorded per-feature pattern/token records.
//  2. Build the Go pattern table from the embedded compat data.
//  3. Assert feature order, pattern source, and token list all match upstream.
func TestUnicornNoUnnecessaryPolyfillsPatternTableOracle(t *testing.T) {
  var fixture struct {
    Polyfills []struct {
      Feature string   `json:"feature"`
      Pattern string   `json:"pattern"`
      Tokens  []string `json:"tokens"`
    } `json:"polyfills"`
  }
  readPolyfillOracle(t, "upstream-patterns.json", &fixture)
  tables := polyfillPatterns()
  if len(tables.polyfills) != len(fixture.Polyfills) {
    t.Fatalf("pattern count mismatch: want %d, got %d", len(fixture.Polyfills), len(tables.polyfills))
  }
  for index, want := range fixture.Polyfills {
    got := tables.polyfills[index]
    if got.feature != want.Feature {
      t.Fatalf("polyfill[%d] feature: want %q, got %q", index, want.Feature, got.feature)
    }
    if got.patternSource != want.Pattern {
      t.Fatalf("polyfill[%d] %q pattern:\nwant %s\ngot  %s", index, want.Feature, want.Pattern, got.patternSource)
    }
    assertPolyfillStringSlice(t, "polyfill "+want.Feature+" tokens", got.tokens, want.Tokens)
  }
}
