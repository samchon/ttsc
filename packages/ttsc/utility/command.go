package utility

import (
  "fmt"
  "io"
)

// RunCommandWithIO dispatches the standalone utility plugin command using the
// package identity and version supplied by its entrypoint. stdout and stderr
// are borrowed non-nil writers; build, transform and check retain their existing
// host flags, project loading, plugin registration and command status policies.
//
// Metadata aliases use only the first argument and do not load a project.
// Empty argv and unknown first arguments return usage status 2. Metadata and
// usage writes retain the entrypoints' existing unchecked write-error behavior.
//
// Dispatch interprets argv and borrowed streams as Go values. Filesystem
// operations, compiler processing and Program leases remain with the host
// operations; this adapter keeps no cache or resources across calls.
//
// @evidence contracts/common.md#principled-implementation The first argv token selects the same metadata aliases and three host operations as the standalone entrypoints; remaining arguments and invocation writers pass unchanged to their actual WithIO owners.
// @evidence contracts/common.md#clear-and-simple-design One command switch owns parsing for all three real utility plugin entrypoints; compiler work remains in the existing build, transform and check operations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts All three production entrypoints call this dispatch; no test callback or alternate predicate duplicates command classification, and unknown tokens do not fall through to a compiler operation.
// @evidence contracts/common.md#meaningful-documentation Native prose states package metadata provenance, borrowed writer requirements, no-project aliases, usage status and the retained metadata write-error limitation separately from these tags.
func RunCommandWithIO(packageName, version string, args []string, stdout, stderr io.Writer) int {
  if len(args) == 0 {
    fmt.Fprintf(stderr, "%s: command required (expected build|transform|check|version)\n", packageName)
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintf(stdout, "%s %s\n", packageName, version)
    return 0
  case "build":
    return RunBuildWithIO(args[1:], stdout, stderr)
  case "transform":
    return RunTransformWithIO(args[1:], stdout, stderr)
  case "check":
    return RunCheckWithIO(args[1:], stdout, stderr)
  default:
    fmt.Fprintf(stderr, "%s: unknown command %q\n", packageName, args[0])
    return 2
  }
}
