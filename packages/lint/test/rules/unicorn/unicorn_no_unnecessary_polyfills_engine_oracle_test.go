package linthost

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"
  "time"
)

// Browserslist and core-js compatibility fixtures record real pinned upstream
// execution. The pattern fixture instead uses pinned data and camelCase in an
// independently transcribed JavaScript reference construction; shared
// transcription mistakes remain a limitation of that table oracle.

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
// @evidence contracts/testing.md#behavioral-verification browserslistResolve executes every fixture query with a frozen clock and requires its complete target list or a resolver error.
// @evidence contracts/testing.md#independent-expectations Expected lists and errors originate from pinned upstream Browserslist execution under the recorded clock and environment, not the Go resolver.
// @evidence contracts/testing.md#distinguishing-cases Successful, empty and malformed/error queries remain distinct; failures print their actual query or index, preserving identity inside the shared loop.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsBrowserslistQueryOracle owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
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


