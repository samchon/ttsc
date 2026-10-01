package driver_test

import (
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteSkipsIdentifierPrefix verifies root matching starts at a
// real identifier boundary.
//
// This covers the guard that prevents a root named plugin from matching the
// trailing substring inside another identifier such as notplugin.
//
// 1. Compile one non-target call and one target plugin call.
// 2. Register a consuming rewrite for the plugin root.
// 3. Assert only the standalone plugin call is replaced.
func TestDriverRewriteSkipsIdentifierPrefix(t *testing.T) {
  js := emitIndexWithRewrite(t, `declare const notplugin: { make(input: string): string };
declare const plugin: { make(input: string): string };
export const kept = notplugin.make("kept");
export const value = plugin.make("target");
`, driver.Rewrite{
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"replaced"`,
    ConsumeParens: true,
  })
  // The replacement differs from the call's own argument, so an unrewritten
  // `plugin.make("target")` cannot satisfy the second check.
  if !strings.Contains(js, `exports.kept = notplugin.make("kept");`) || !strings.Contains(js, `exports.value = "replaced";`) {
    t.Fatalf("identifier-prefix rewrite mismatch:\n%s", js)
  }
}
