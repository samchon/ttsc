package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverPluginConfigBaseDirPrecedence verifies the anchor ladder of
// PluginConfigBaseDir: the explicit TTSC_PLUGIN_CONFIG_DIR channel wins when
// set (absolute or cwd-relative), a blank channel falls back to the tsconfig
// directory (itself resolved against cwd), and an empty tsconfig falls back
// to cwd.
//
// The helper is the single mechanism through which @ttsc/banner and
// @ttsc/strip anchor config-file discovery and relative configFile
// resolution, so every branch here maps to a user-visible discovery origin.
//
//  1. Probe the env branch with an absolute and a cwd-relative value.
//  2. Probe the blank/whitespace env fallbacks with absolute and relative
//     tsconfig paths.
//  3. Probe the empty-tsconfig cwd fallback.
func TestDriverPluginConfigBaseDirPrecedence(t *testing.T) {
  cwd := t.TempDir()
  project := t.TempDir()

  t.Setenv(driver.PluginConfigDirEnv, project)
  if got := driver.PluginConfigBaseDir(cwd, filepath.Join(cwd, "tsconfig.json")); got != filepath.Clean(project) {
    t.Fatalf("absolute env value must win: %q", got)
  }

  t.Setenv(driver.PluginConfigDirEnv, "nested/app")
  if got := driver.PluginConfigBaseDir(cwd, ""); got != filepath.Join(cwd, "nested", "app") {
    t.Fatalf("relative env value must resolve against cwd: %q", got)
  }

  t.Setenv(driver.PluginConfigDirEnv, "  ")
  if got := driver.PluginConfigBaseDir(cwd, filepath.Join(project, "tsconfig.json")); got != filepath.Clean(project) {
    t.Fatalf("whitespace env must fall back to the tsconfig directory: %q", got)
  }
  if got := driver.PluginConfigBaseDir(cwd, filepath.Join("packages", "demo", "tsconfig.json")); got != filepath.Join(cwd, "packages", "demo") {
    t.Fatalf("relative tsconfig must resolve against cwd: %q", got)
  }
  if got := driver.PluginConfigBaseDir(cwd, ""); got != cwd {
    t.Fatalf("empty tsconfig must fall back to cwd: %q", got)
  }
}
