package linthost

import (
  "encoding/json"
  "fmt"
  "io"
  "path/filepath"
  "runtime"
  "testing"
  "weak"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestResidentRegexCacheRetiresReloadedConfigurations verifies actual resident
// config reloads retire historical patterns while live engines keep valid results.
//
// Alternating marker semantics prove each JSON generation reaches Engine.Run.
// Weak references observe owner retirement without relying on heap sizes or time.
//
//  1. Reload sixteen distinct patterns through acquireRules and run each twice.
//  2. Fail a reload, recover with rule removal, and send resident invalidation.
//  3. Assert retired caches are collectible while an old live engine still works.
//  4. Release that engine and assert its last cache becomes collectible as well.
//
// @evidence contracts/testing.md#behavioral-verification Actual JSON acquireRules reloads feed Engine.Run with alternating zero/one findings; repeated engines reuse regexp identities, failed loading clears the memo, and removal/invalidation/GC releases obsolete caches while a retained old engine preserves its original policy.
// @evidence contracts/testing.md#independent-expectations The source has one switch with a round-marker comment; even patterns include exactly that marker and odd patterns exclude it. Go weak-pointer semantics expose reachability after explicit owner release, independently of retained-byte estimates or elapsed deadlines.
// @evidence contracts/testing.md#distinguishing-cases Sixteen changed valid configurations, unchanged repeated use, a malformed JSON load, recovery without a regex rule, resident invalidation and one intentionally retained old engine cover success, failure, replacement and transfer. Direct malformed regex and concurrent requests have separate cases.
// @evidence contracts/testing.md#execution-ownership The in-process resolver reads a temporary JSON project and Engine.Run walks its parsed source; the resident invalidation handler uses an installed in-process Program cache. No native producer, consumer installation or daemon process is required.
func TestResidentRegexCacheRetiresReloadedConfigurations(t *testing.T) {
  source := "declare const foo: number;\nswitch (foo) {\n case 0: break;\n // round-marker\n}\n"
  root := seedLintProject(t, source)
  file := parseTSFile(t, filepath.Join(root, "src/main.ts"), source)
  previousRules, previousPrograms := residentRules, residentPrograms
  programs := newResidentProgramCache()
  residentRules = &residentRuleCache{}
  residentPrograms = programs
  defer func() {
    programs.invalidate()
    residentRules, residentPrograms = previousRules, previousPrograms
  }()
  manifest := lintManifest(t)
  retired := func() []weak.Pointer[userPatternCache] {
    var caches []weak.Pointer[userPatternCache]
    var live *Engine
    for generation := range 16 {
      pattern := fmt.Sprintf("^extra-round-%02d$", generation)
      if generation%2 == 0 {
        pattern = fmt.Sprintf("^(round-marker|extra-round-%02d)$", generation)
      }
      seedLintConfig(t, root, map[string]any{
        "rules": map[string]any{
          "default-case": []any{"error", map[string]any{"commentPattern": pattern}},
        },
      })
      resolver, err := acquireRules(manifest, root, "tsconfig.json")
      if err != nil {
        t.Fatal(err)
      }
      engine := NewEngineWithResolver(resolver)
      if findings := engine.Run([]*shimast.SourceFile{file}, nil); len(findings) != generation%2 {
        t.Fatalf("generation %d: got %d findings", generation, len(findings))
      }
      ctx := &Context{patterns: engine.patterns}
      compiled, err := ctx.compileUserPattern(pattern)
      if err != nil {
        t.Fatal(err)
      }
      repeated := NewEngineWithResolver(resolver)
      if findings := repeated.Run([]*shimast.SourceFile{file, file}, nil); len(findings) != 2*(generation%2) {
        t.Fatalf("generation %d: repeated engine changed findings", generation)
      }
      again, err := (&Context{patterns: repeated.patterns}).compileUserPattern(pattern)
      if err != nil || again != compiled {
        t.Fatalf("generation %d: live configuration did not reuse compilation", generation)
      }
      caches = append(caches, weak.Make(engine.patterns))
      if generation == 0 {
        live = engine
      }
    }
    if residentRules.loads != 16 {
      t.Fatalf("expected sixteen actual reloads, got %d", residentRules.loads)
    }
    writeFile(t, filepath.Join(root, "lint.config.json"), "{")
    if _, err := acquireRules(manifest, root, "tsconfig.json"); err == nil || residentRules.resolver != nil {
      t.Fatal("failed configuration reload retained a prior resolver")
    }
    seedLintRules(t, root, map[string]string{"no-debugger": "error"})
    resolver, err := acquireRules(manifest, root, "tsconfig.json")
    if err != nil {
      t.Fatal(err)
    }
    if findings := NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil); len(findings) != 0 {
      t.Fatal("removed regex rule still produced a finding")
    }
    if err := handleServeLSPLine(`{"invalidate":true}`, &lspCommandOptions{
      cwd: root, pluginsJSON: manifest, tsconfig: "tsconfig.json",
    }, json.NewEncoder(io.Discard)); err != nil {
      t.Fatal(err)
    }
    runtime.GC()
    for generation, cache := range caches {
      if (cache.Value() != nil) != (generation == 0) {
        t.Fatalf("generation %d: cache reachability does not follow live ownership", generation)
      }
    }
    if findings := live.Run([]*shimast.SourceFile{file}, nil); len(findings) != 0 {
      t.Fatal("replacement invalidated a live engine's original configuration")
    }
    runtime.KeepAlive(live)
    return caches
  }()
  runtime.GC()
  for generation, cache := range retired {
    if cache.Value() != nil {
      t.Fatalf("generation %d: released owner retained its historical cache", generation)
    }
  }
  if residentRules.loads != 18 {
    t.Fatalf("expected reload, failure and recovery loads, got %d", residentRules.loads)
  }
}
