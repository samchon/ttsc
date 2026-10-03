//go:build windows

package lspserver

import (
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// TestLauncherReloadDirectoryFingerprintMatchesGo verifies that the JavaScript
// built JavaScript fingerprint is accepted by Go for two Windows inputs.
//
// A Node child imports the built fingerprint module and reports each digest;
// the in-process Go normalizer/currentness validator consumes it. This observes
// protocol agreement, not an independently correct physical identity, native
// watcher registration or a historical case-folding failure.
//
//  1. Ask the built JavaScript launcher to fingerprint one existing directory
//     and one missing descendant under the owned temporary parent.
//  2. Pass each launcher-produced digest through the real Go snapshot
//     normalization path.
//  3. Prove the Go currentness validator accepts both unchanged directories.
//
// @evidence contracts/testing.md#behavioral-verification A Node-produced built-module digest is accepted by the actual Go normalizer and currentness validator for one existing empty directory and one missing sibling. The parent's case-sensitivity is not established, and no differently cased alias is compared.
// @evidence contracts/testing.md#independent-expectations Literal acceptance/currentness expectations compare two implementations, with the JavaScript output supplied as protocol input to Go. Their agreement does not independently certify the digest algorithm or physical identity; matching defects could agree.
// @evidence contracts/testing.md#distinguishing-cases Existing and missing siblings distinguish observable topology from missing-path fallback. Case-sensitive directories, alternate spellings, changed topology and malformed digests are not exercised here.
// @evidence contracts/testing.md#execution-ownership TestLauncherReloadDirectoryFingerprintMatchesGo is a Go test built only on Windows in the lspserver package: it runs the built JavaScript launcher through node to produce the digest and then calls the Go validator in-process.
// @evidence contracts/e2e.md#necessary-boundary The selected built JavaScript module emits digests consumed by the actual Go validator. Direct tests of either implementation alone do not observe this cross-runtime format agreement; no full launcher or native watch registration is claimed.
// @evidence contracts/e2e.md#shared-execution Both inputs use the same built module and temporary parent, but the current helper starts two Node children. Shared-process preparation and experiment discovery remain separate unresolved consolidation work; this body does not certify reduced startup counts.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity The test owns an isolated existing directory and missing sibling. Each CombinedOutput joins its own direct child and keeps returned error/output semantics, while no descendant lifecycle or artifact-byte identity is established by the relative built-module filename.
// @evidence contracts/e2e.md#preserved-coverage Both original input directories and each normalizer/currentness assertion remain here. The private command observer is opt-in and authored but unexecuted; selection, artifact identity and runtime survival are unconfirmed.
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
    filepath.Join("..", "..", "lib", "launcher", "internal", "ttscserver", "fingerprintInitialLSPProjectInputSnapshot.js"),
  )
  if err != nil {
    t.Fatal(err)
  }
  script, err := os.ReadFile(filepath.Join("..", "..", "test", "fixtures", "e2e", "launcher_reload_directory_fingerprint_parity_windows", "fingerprint.mjs.txt"))
  if err != nil {
    t.Fatal(err)
  }
  command := exec.Command(
    "node",
    "--input-type=module",
    "--eval",
    string(script),
    module,
    directory,
    root,
  )
  observation := e2etrace.BeginCommand(command, "CombinedOutput")
  output, err := command.CombinedOutput()
  observation.Result(err)
  if err != nil {
    t.Fatalf("launcher fingerprint for %q: %v\n%s", directory, err, output)
  }
  return strings.TrimSpace(string(output))
}
