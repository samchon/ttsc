package linthost

import (
  "path/filepath"
  "testing"
  "time"
)

// TestResidentRuleCacheRespectsConfigCacheOptOut verifies the config-cache
// escape hatch also declines a resolver snapshot already held by the resident
// daemon. Otherwise the evaluator cache would be disabled while the outer memo
// continued serving the very result the opt-out asked to bypass.
//
//  1. Record a settled config while caching is enabled.
//  2. Enable `TTSC_LINT_DISABLE_CONFIG_CACHE` and reject that snapshot.
//  3. Require the opt-out to prevent a replacement snapshot too.
func TestResidentRuleCacheRespectsConfigCacheOptOut(t *testing.T) {
  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "")
  location := filepath.Join(t.TempDir(), "lint.config.json")
  writeFile(t, location, `{"rules":{}}`)
  resolver := &ConfigStore{cacheFiles: []string{location}}
  snapshot := hashRuleConfigs(resolver, time.Now())
  if snapshot == nil {
    t.Fatal("enabled resident cache did not record a settled config")
  }

  t.Setenv("TTSC_LINT_DISABLE_CONFIG_CACHE", "1")
  if ruleConfigsUnchanged(snapshot) {
    t.Fatal("config cache opt-out reused an existing resident resolver")
  }
  if hashRuleConfigs(resolver, time.Now()) != nil {
    t.Fatal("config cache opt-out recorded a new resident resolver")
  }
}
