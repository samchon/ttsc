package banner_test

import (
  "os"
  "path/filepath"
  "runtime"
  "strings"
  "testing"
)

// TestNodeEnvironmentHelpers verifies node_modules discovery and env assembly.
//
// Config files execute in a temporary loader directory, so the banner driver
// has to project nearby node_modules into that directory and into NODE_PATH.
// These helpers are intentionally small, but broken ordering would make
// package-local config dependencies fail only at runtime.
//
// 1. Discover nearest node_modules from nested config directories.
// 2. Build NODE_PATH while preserving existing entries and replacement logic.
// 3. Link node_modules into loader tempdirs and cover the symlink failure path.
func TestNodeEnvironmentHelpers(t *testing.T) {
  root := t.TempDir()
  project := filepath.Join(root, "project")
  nested := filepath.Join(project, "src", "config")
  nodeModules := filepath.Join(project, "node_modules")
  if err := os.MkdirAll(filepath.Join(nodeModules, "pkg"), 0o755); err != nil {
    t.Fatal(err)
  }
  if got := bannerFindNearestNodeModules(nested); got != nodeModules {
    t.Fatalf("nearest node_modules mismatch: %q", got)
  }
  // Hermetic: a stray node_modules above the test temp dir (developer
  // machines have them at drive roots) is a legitimate discovery — only a
  // hit inside the fixture would be a bug.
  if got := bannerFindNearestNodeModules(filepath.Join(root, "without-modules")); got != "" && strings.HasPrefix(got, root) {
    t.Fatalf("unexpected node_modules discovery: %q", got)
  }

  t.Setenv("NODE_PATH", "existing")
  env := bannerNodeConfigLoaderEnv(filepath.Join(nested, "banner.config.cjs"))
  nodePath := ""
  for _, entry := range env {
    if strings.HasPrefix(entry, "NODE_PATH=") {
      nodePath = strings.TrimPrefix(entry, "NODE_PATH=")
    }
  }
  expected := nodeModules + string(os.PathListSeparator) + "existing"
  if nodePath != expected {
    t.Fatalf("NODE_PATH mismatch: got %q expected %q", nodePath, expected)
  }
  t.Setenv("NODE_PATH", "")
  if got := bannerNodeConfigLoaderEnv(filepath.Join(root, "plain", "banner.config.cjs")); len(got) != len(os.Environ()) {
    t.Fatalf("expected unchanged env length without node_modules, got %d want %d", len(got), len(os.Environ()))
  }

  replaced := bannerSetEnv([]string{"A=1", "NODE_PATH=old"}, "NODE_PATH", "new")
  if len(replaced) != 2 || replaced[1] != "NODE_PATH=new" {
    t.Fatalf("replace env mismatch: %#v", replaced)
  }
  appended := bannerSetEnv([]string{"A=1"}, "NODE_PATH", "new")
  if len(appended) != 2 || appended[1] != "NODE_PATH=new" {
    t.Fatalf("append env mismatch: %#v", appended)
  }

  // Hermetic for the same reason as above: with a stray ancestor
  // node_modules the call is a real link attempt, not a no-op.
  if bannerFindNearestNodeModules(filepath.Join(root, "without-modules")) == "" {
    if err := bannerLinkNearestNodeModules(filepath.Join(root, "no-link"), filepath.Join(root, "without-modules")); err != nil {
      t.Fatalf("no node_modules link should be a no-op: %v", err)
    }
  }
  if runtime.GOOS == "windows" {
    t.Skip("symlink creation is privilege-dependent on Windows")
  }
  linkDir := filepath.Join(root, "loader")
  if err := os.MkdirAll(linkDir, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := bannerLinkNearestNodeModules(linkDir, nested); err != nil {
    t.Fatal(err)
  }
  if target, err := os.Readlink(filepath.Join(linkDir, "node_modules")); err != nil || target != nodeModules {
    t.Fatalf("node_modules symlink mismatch: target=%q err=%v", target, err)
  }
  failingLinkDir := filepath.Join(root, "loader-conflict")
  if err := os.MkdirAll(failingLinkDir, 0o755); err != nil {
    t.Fatal(err)
  }
  writeFile(t, filepath.Join(failingLinkDir, "node_modules"), "conflict")
  if err := bannerLinkNearestNodeModules(failingLinkDir, nested); err == nil || !strings.Contains(err.Error(), "link config node_modules") {
    t.Fatalf("expected symlink conflict error, got %v", err)
  }
}
