//go:build windows

package lspserver

import (
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
)

// TestLauncherReloadDirectoryFingerprintMatchesGo verifies that the JavaScript
// launcher and Go host serialize the same Windows physical directory identity.
//
// The launcher formerly retained a physical drive volume while Go lowercased
// it, and the two sides also disagreed about case folding for a missing suffix.
// A stable launcher snapshot was therefore rejected as stale during native
// watcher registration.
//
//  1. Ask the built JavaScript launcher to fingerprint one existing directory
//     and one missing descendant under an ordinary case-insensitive parent.
//  2. Pass each launcher-produced digest through the real Go snapshot
//     normalization path.
//  3. Prove the Go currentness validator accepts both unchanged directories.
func TestLauncherReloadDirectoryFingerprintMatchesGo(t *testing.T) {
  root := t.TempDir()
  existing := filepath.Join(root, "ExistingDirectory")
  if err := os.Mkdir(existing, 0o755); err != nil {
    t.Fatal(err)
  }
  for _, directory := range []string{
    existing,
    filepath.Join(root, "MissingDirectory"),
  } {
    digest := launcherReloadDirectoryDigest(t, root, directory)
    snapshot, err := normalizeLSPProjectInputSnapshot(
      LSPProjectInputSnapshot{
        Root:              root,
        ReloadDirectories: []string{directory},
        ReloadDirectoryDigests: map[string]string{
          directory: digest,
        },
      },
      root,
    )
    if err != nil {
      t.Fatalf("normalize launcher fingerprint for %q: %v", directory, err)
    }
    if !projectInputReloadFingerprintsAreCurrent(snapshot) {
      t.Fatalf("launcher fingerprint for %q began stale in Go", directory)
    }
  }
}

func launcherReloadDirectoryDigest(
  t *testing.T,
  root string,
  directory string,
) string {
  t.Helper()
  module, err := filepath.Abs(
    filepath.Join("..", "..", "lib", "launcher", "internal", "runTtscserver.js"),
  )
  if err != nil {
    t.Fatal(err)
  }
  script := `
    import { pathToFileURL } from "node:url";
    const launcher = await import(pathToFileURL(process.argv[1]).href);
    const location = process.argv[2];
    const snapshot = launcher.fingerprintInitialLSPProjectInputSnapshot({
      files: [],
      globs: [],
      reloadDirectories: [location],
      root: process.argv[3],
    });
    process.stdout.write(snapshot.reloadDirectoryDigests[location]);
  `
  command := exec.Command(
    "node",
    "--input-type=module",
    "--eval",
    script,
    module,
    directory,
    root,
  )
  output, err := command.CombinedOutput()
  if err != nil {
    t.Fatalf("launcher fingerprint for %q: %v\n%s", directory, err, output)
  }
  return strings.TrimSpace(string(output))
}
