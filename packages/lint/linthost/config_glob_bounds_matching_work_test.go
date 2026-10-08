package linthost

import (
  "encoding/json"
  "fmt"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

// TestConfigGlobBoundsMatchingWork verifies compact selectors do not enumerate
// brace products or globstar path partitions.
//
// The matcher owns a set of visited graph/name states as part of its real
// duplicate suppression. Its size cannot exceed the product of graph nodes
// and legal name positions. This checks that structural bound rather than an
// elapsed-time deadline, alongside independently known match/miss results.
//
// 1. Match first and last alternatives and misses for adjacent/empty brace groups.
// 2. Match interleaved globstars with zero/many components and an adjacent miss.
// 3. Require compact graph storage and visited states within their input-derived bounds.
//
// @evidence contracts/testing.md#behavioral-verification Actual matchGlob, its graph/native matcher owners and public LoadConfigResolver/ResolveRules accept first/late alternatives, brace-generated classes and matching interleaved globstars, reject suffix misses, and expose real syntax/visited-state populations. Public resolver allocation bytes are descriptive observations around successful and unsuccessful resolutions.
// @evidence contracts/testing.md#independent-expectations Literal a/b alternatives and good.ts/bad.ts define results independently. Each authored byte contributes at most one syntax node; legal ordinary byte offsets plus two boundary modes bound graph states, while component index pairs bound native globstar states. These input-derived bounds do not depend on traversal order. Allocation observations have no machine-dependent pass threshold and do not claim a wall-time speedup or bound native filesystem work.
// @evidence contracts/testing.md#distinguishing-cases Sizes 16/32/64 cover first/last/full miss, empty alternatives, alternative character classes and interleaved globstar many/zero-component cases; 64 independent binary alternatives rule out materializing their Cartesian product. The semantic corpus owns malformed syntax and platform escape differences.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit invokes actual public/private selector operations in-process on authored strings and isolated JSON files; observed state maps are production duplicate-suppression storage, with no timing hook, installed artifact or product process. The test owns temporary config files and brackets each public resolution with runtime allocation observations.
func TestConfigGlobBoundsMatchingWork(t *testing.T) {
  for _, size := range []int{16, 32, 64} {
    rows := []struct { pattern, name string; want bool }{
      {strings.Repeat("{a,b}", size)+".ts", strings.Repeat("a", size)+".ts", true},
      {strings.Repeat("{a,b}", size)+".ts", strings.Repeat("b", size)+".ts", true},
      {strings.Repeat("{a,b}", size)+".ts", strings.Repeat("a", size)+".js", false},
      {strings.Repeat("{,a}", size)+".ts", strings.Repeat("a", size)+".ts", true},
      {strings.Repeat("{,a}", size)+".ts", "b.ts", false},
      {"["+strings.Repeat("{a,b}", size)+"]", "a", true},
      {"["+strings.Repeat("{a,b}", size)+"]", "c", false},
      {strings.Repeat("**/a/", size)+"good.ts", strings.Repeat("a/", size*2)+"good.ts", true},
      {strings.Repeat("**/a/", size)+"good.ts", strings.Repeat("a/", size*2)+"bad.ts", false},
      {strings.Repeat("**/a/", size)+"good.ts", strings.Repeat("a/", size)+"good.ts", true},
      {strings.Repeat("{**,*}/a/", size)+"good.ts", strings.Repeat("a/", size*2)+"good.ts", true},
      {strings.Repeat("{**,*}/a/", size)+"good.ts", strings.Repeat("a/", size*2)+"bad.ts", false},
    }
    for _, row := range rows {
      if got := matchGlob(row.pattern, row.name); got != row.want {
        t.Errorf("public size=%d pattern=%q name=%q: got %v want %v", size, row.pattern, row.name, got, row.want)
      }
      if !strings.Contains(row.pattern, "{") {
        matcher := configGlobNativeMatcher{pattern: strings.Split(row.pattern, "/"), name: strings.Split(row.name, "/"), states: make(map[[2]int]bool)}
        if got := matcher.matches(0, 0); got != row.want {
          t.Errorf("native size=%d: got %v want %v", size, got, row.want)
        }
        bound := (len(matcher.pattern)+1)*(len(matcher.name)+1)
        if len(matcher.states) > bound {
          t.Errorf("native states=%d exceed component-pair bound=%d", len(matcher.states), bound)
        }
        t.Logf("native size=%d patternParts=%d nameParts=%d visited=%d matched=%v", size, len(matcher.pattern), len(matcher.name), len(matcher.states), row.want)
        continue
      }
      graph := compileConfigGlob(row.pattern)
      matcher := newConfigGlobMatcher(graph, row.name)
      if got := matcher.matches(); got != row.want {
        t.Errorf("size=%d pattern=%q name=%q: got %v want %v", size, row.pattern, row.name, got, row.want)
      }
      if len(graph.nodes) > len(row.pattern)+1 {
        t.Errorf("syntax materialized alternatives: %d nodes for %d authored bytes", len(graph.nodes), len(row.pattern))
      }
      namePositions := 2*(len(matcher.parts)+1)
      for _, part := range matcher.parts { namePositions += len(part)+1 }
      if len(matcher.seen) > len(graph.nodes)*namePositions {
        t.Errorf("matching revisited partitions: %d states exceed %d nodes * %d legal name positions", len(matcher.seen), len(graph.nodes), namePositions)
      }
      t.Logf("size=%d patternBytes=%d nameBytes=%d graphNodes=%d visited=%d classes=%d matched=%v", size, len(row.pattern), len(row.name), len(graph.nodes), len(matcher.seen), len(matcher.classes), row.want)
    }
  }
  root := t.TempDir()
  for _, size := range []int{16, 32, 64} {
    pattern := strings.Repeat("{a,b}", size)+".ts"
    raw, err := json.Marshal(map[string]any{"files": []string{pattern}, "rules": map[string]any{"no-var": "error"}})
    if err != nil { t.Fatal(err) }
    location := filepath.Join(root, fmt.Sprintf("braces-%d.json", size))
    writeFile(t, location, string(raw))
    resolver, err := LoadConfigResolver(&PluginEntry{Config: map[string]any{"configFile": location}}, root, filepath.Join(root, "tsconfig.json"))
    if err != nil { t.Fatal(err) }
    for repeat := 0; repeat < 3; repeat++ {
      for _, row := range []struct { name, kind string; want bool }{
        {strings.Repeat("a", size)+".ts", "first", true},
        {strings.Repeat("b", size)+".ts", "last", true},
        {strings.Repeat("a", size)+".js", "miss", false},
      } {
        runtime.GC()
        var before, after runtime.MemStats
        runtime.ReadMemStats(&before)
        resolved := resolver.ResolveRules(filepath.Join(root, row.name))
        runtime.ReadMemStats(&after)
        if got := resolved.Rules.Severity("no-var") == SeverityError; got != row.want {
          t.Errorf("public resolver size=%d kind=%s: got %v want %v", size, row.kind, got, row.want)
        }
        t.Logf("public resolver groups=%d kind=%s repeat=%d allocatedBytes=%d matched=%v", size, row.kind, repeat, after.TotalAlloc-before.TotalAlloc, row.want)
      }
    }
  }
}
