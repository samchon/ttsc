package linthost

import (
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestConfigCachePreservesPatternPrecedence verifies cached configuration
// retains the first matching string-content pattern after a disk round trip.
//
// A cold evaluation, its memory hit and a disk-only hit must select the same
// authored pattern. This direct cache-policy unit deliberately supplies an
// evaluator callback instead of starting a real script loader.
//
// 1. Decode an ordered JSON fixture through a call-counting evaluator.
// 2. Load cold, reuse memory, then evict only this entry and reuse disk.
// 3. Execute each returned config and compare its full fixed file with a literal.
//
// @evidence contracts/testing.md#behavioral-verification loadCachedConfigFile evaluates an ordered JSON fixture once and serves memory and disk hits. Each value is folded into a ConfigStore and run through the real string-content engine and fix applier; all three complete files must contain the authored first replacement and unchanged unmatched literal.
// @evidence contracts/testing.md#independent-expectations The literal first output follows Unicorn's first matching non-integer pattern policy. Exactly one evaluator call across cold/memory/disk phases follows cache reuse, independently of the cache-key computation used only to evict this test's entry.
// @evidence contracts/testing.md#distinguishing-cases Cold evaluation contrasts with the unchanged memory hit and the hit after only this entry is removed from memory. The latter must reuse disk without evaluating and preserve option order; each phase also requires an active error rule, exactly one finding/edit and an unchanged nonmatching literal.
// @evidence contracts/testing.md#execution-ownership This selected Go entry owns three named phases. JSON loading, cache policy, ConfigStore folding, parsing, engine execution and file rewriting occur directly in one Go process; the callback does not execute a config script, install a consumer or start a product host. Cleanup removes only the unique temporary project's cache entry.
func TestConfigCachePreservesPatternPrecedence(t *testing.T) {
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  root := t.TempDir()
  location := filepath.Join(root, "lint.config.cjs")
  content := "module.exports = {};\n"
  writeFile(t, location, content)
  payload := filepath.Join(root, "payload.json")
  writeFile(t, payload, `{"rules":{"unicorn/string-content":["error",{"patterns":{"foo$":"first","foo":"second"}}]}}`)
  key := configCacheKey("config-value", location, []byte(content))
  t.Cleanup(func() {
    configEvalCacheMu.Lock()
    delete(configEvalCache, key)
    configEvalCacheMu.Unlock()
    if err := os.Remove(filepath.Join(configCacheDir(), key+".json")); err != nil && !os.IsNotExist(err) {
      t.Errorf("remove owned cache entry: %v", err)
    }
  })
  calls := 0
  evaluate := func(string) (any, error) {
    calls++
    return loadJSONConfigFile(payload)
  }
  for _, phase := range []string{"cold", "memory hit", "disk hit"} {
    if phase == "disk hit" {
      configEvalCacheMu.Lock()
      delete(configEvalCache, key)
      configEvalCacheMu.Unlock()
    }
    t.Run(phase, func(t *testing.T) {
      value, err := loadCachedConfigFile(location, evaluate)
      if err != nil {
        t.Fatalf("loadCachedConfigFile: %v", err)
      }
      if calls != 1 {
        t.Fatalf("want one evaluation across cache phases, got %d", calls)
      }
      store, err := collectConfigStore(value, root, location)
      if err != nil {
        t.Fatalf("collectConfigStore: %v", err)
      }
      engine := NewEngineWithResolver(store)
      if err := engine.ConfigError(); err != nil {
        t.Fatalf("NewEngineWithResolver: %v", err)
      }
      if engine.EnabledRules()["unicorn/string-content"] != SeverityError {
        t.Fatal("cached config did not enable string-content at error severity")
      }
      filePath := filepath.Join(root, phase+".ts")
      source := "const value = \"foo\";\nconst untouched = \"untouched\";\n"
      expected := "const value = \"first\";\nconst untouched = \"untouched\";\n"
      writeFile(t, filePath, source)
      engine.SetCurrentDirectory(root)
      file := parseTSFile(t, filePath, source)
      findings := engine.Run([]*shimast.SourceFile{file}, nil)
      if len(findings) != 1 || findings[0].Rule != "unicorn/string-content" || findings[0].Severity != SeverityError {
        t.Fatalf("want one string-content/error finding, got %+v", findings)
      }
      fixed, err := applyFindingFixes(root, findings)
      if err != nil || fixed != 1 {
        t.Fatalf("want one applied edit, got %d, error %v", fixed, err)
      }
      actual, err := os.ReadFile(filePath)
      if err != nil {
        t.Fatalf("ReadFile: %v", err)
      }
      if string(actual) != expected {
        t.Fatalf("cached config output:\nwant %q\ngot  %q", expected, string(actual))
      }
    })
  }
}
