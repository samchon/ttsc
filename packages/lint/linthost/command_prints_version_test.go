package linthost

import (
  "testing"
)

// TestCommandPrintsVersion verifies the lint sidecar exposes command metadata.
//
// The version branch must not depend on a project fixture. Package discovery and
// smoke checks should be able to ask the native binary for its version even when
// no tsconfig is available.
//
// This scenario keeps version handling separate from compile paths. It proves
// the command wrapper can return metadata without touching the lint engine.
//
// 1. Invoke version, --version and -v through the real run front door.
// 2. Capture stdout and stderr exactly as the host would.
// 3. Assert successful status and the @ttsc/lint version banner.
//
// @evidence contracts/testing.md#behavioral-verification run returns status0, empty stderr and the complete authored version banner for version, --version and -v aliases without requiring a project.
// @evidence contracts/testing.md#independent-expectations Version is an owned command input pinned to a test sentinel; the literal @ttsc/lint unit-version newline string independently verifies format and transport rather than merely checking a package-name substring.
// @evidence contracts/testing.md#distinguishing-cases Owns all three accepted version aliases and a nondefault version value; missing/unknown subcommands exercise rejection separately.
// @evidence contracts/testing.md#execution-ownership TestCommandPrintsVersion is a selected Go unit entry calling command dispatch or its owning helper in-process; output capture observes the owned stdout/stderr route without building a native artifact, installing a consumer or spawning a product process.
func TestCommandPrintsVersion(t *testing.T) {
  previous := Version
  Version = "unit-version"
  t.Cleanup(func() { Version = previous })
  for _, command := range []string{"version", "--version", "-v"} {
    t.Run(command, func(t *testing.T) {
      code, stdout, stderr := captureCommandOutput(t, func() int {
        return run([]string{command})
      })
      if code != 0 || stderr != "" || stdout != "@ttsc/lint unit-version\n" {
        t.Fatalf("version mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
      }
    })
  }
}
