package main

import (
  "bytes"
  "context"
  "os"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/lspserver"
)

// TestTtscserverCommandOperationFamilies verifies the command's metadata and invalid invocation operations directly.
//
// The five original case identities retain their literal statuses and output
// assertions while using the same run dispatcher that main calls. These cases
// finish before native server or compiler startup and need no project fixture.
//
// 1. Register the five original case names as sequential subtests.
// 2. Invoke actual run through isolated full-byte output writers.
// 3. Assert every original alias, status and diagnostic distinction.
//
// @evidence contracts/testing.md#behavioral-verification The five named private scenarios directly call run and preserve default help, all help/version aliases and the two invalid invocation categories with their original literal status and stream assertions.
// @evidence contracts/testing.md#independent-expectations Existing literal help/banner/diagnostic fragments and zero/two statuses express the supported command contract independently of captured output; release metadata remains intentionally unconstrained.
// @evidence contracts/testing.md#distinguishing-cases Empty argv, three help aliases, three version aliases and two rejection categories remain identifiable by their original case names. Private scenario documentation states each case's exact distinctions and oracle limits.
// @evidence contracts/testing.md#execution-ownership This public default Go entry owns five sequential named scenarios in its implementation package. Each calls actual run without a producer, process host, compiler Program or project fixture. The Go adapter selects this aggregate; private scenario bodies remain full-surface review obligations.
func TestTtscserverCommandOperationFamilies(t *testing.T) {
  t.Run("TestTtscserverCommandDefaultPrintsHelp", scenarioTestTtscserverCommandDefaultPrintsHelp)
  t.Run("TestTtscserverCommandHelpAliases", scenarioTestTtscserverCommandHelpAliases)
  t.Run("TestTtscserverCommandRejectsMissingStdio", scenarioTestTtscserverCommandRejectsMissingStdio)
  t.Run("TestTtscserverCommandRejectsUnknownFlag", scenarioTestTtscserverCommandRejectsUnknownFlag)
  t.Run("TestTtscserverCommandVersionAliases", scenarioTestTtscserverCommandVersionAliases)
}

// scenarioTestTtscserverCommandDefaultPrintsHelp verifies ttscserver prints help when
// invoked with no arguments.
//
// Editors occasionally probe a newly installed binary by running it bare.
// ttscserver must print the help banner and exit cleanly instead of blocking
// stdin waiting for LSP traffic that will never arrive.
//
// 1. Call the actual owning run operation with no arguments.
// 2. Assert exit 0 and that stdout contains the LSP host banner.
//
// Testing: behavioral-verification Bare ttscserver returns zero and the Language Server Protocol host help banner.
// Testing: independent-expectations The native editor host contract allows project-free probing without entering stdio transport; extra output and stderr are not asserted.
// Testing: distinguishing-cases Empty argv exercises default help separately from the three explicit help aliases.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestTtscserverCommandDefaultPrintsHelp(t *testing.T) {
  code, out, errOut := captureTtscserverCommand(t)
  if code != 0 {
    t.Fatalf("zero-arg run failed: code=%d stderr=%q", code, errOut)
  }
  if !strings.Contains(out, "Language Server Protocol host") {
    t.Fatalf("help banner missing:\n%s", out)
  }
}

// scenarioTestTtscserverCommandHelpAliases verifies every help spelling reaches the
// same banner.
//
// Help is dispatched before any LSP wiring, so the aliases must succeed
// independently of the project layout. An alias that diverged from the main
// help path would show the wrong usage text to users of that spelling.
//
// 1. Call the actual owning run operation -h, --help, and help.
// 2. Assert each alias exits cleanly with the LSP host usage banner.
//
// Testing: behavioral-verification -h, --help and help return zero with ttscserver --stdio usage text.
// Testing: independent-expectations The public help aliases must expose the LSP transport guidance; substring matching permits other help content.
// Testing: distinguishing-cases Three named project-free alias subtests differ from empty argv and transport refusal.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestTtscserverCommandHelpAliases(t *testing.T) {
  for _, flag := range []string{"-h", "--help", "help"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := captureTtscserverCommand(t, flag)
      if code != 0 {
        t.Fatalf("%s help alias failed: code=%d stderr=%q", flag, code, errOut)
      }
      if !strings.Contains(out, "ttscserver --stdio") {
        t.Fatalf("%s output missing usage line:\n%s", flag, out)
      }
    })
  }
}

// scenarioTestTtscserverCommandRejectsMissingStdio verifies the transport guard
// rejects any invocation that omits --stdio.
//
// The native host only speaks stdio. Running without the flag must produce
// a clean exit 2 with an actionable error instead of hanging indefinitely on
// a pipe that the caller never set up.
//
// 1. Call the actual owning run operation with a flag but without --stdio.
// 2. Assert exit code 2 and a message that names the --stdio transport.
//
// Testing: behavioral-verification A cwd flag without --stdio returns usage status two and a diagnostic mentioning --stdio.
// Testing: independent-expectations The native host supports the stdio transport explicitly; omission must reject the invocation.
// Testing: distinguishing-cases A recognized nontransport flag distinguishes this rejection from the unknown-flag case.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestTtscserverCommandRejectsMissingStdio(t *testing.T) {
  code, _, errOut := captureTtscserverCommand(t, "--cwd", ".")
  if code != 2 {
    t.Fatalf("expected exit 2 without --stdio, got %d (stderr=%q)", code, errOut)
  }
  if !strings.Contains(errOut, "--stdio") {
    t.Fatalf("error message missing --stdio mention:\n%s", errOut)
  }
}

// scenarioTestTtscserverCommandRejectsUnknownFlag verifies the flag parser surfaces
// unknown arguments with exit 2 rather than silently ignoring them.
//
// Editors that scaffold the wrong flag for ttscserver should see the failure
// during development, not silent misbehavior in the field where a mistyped
// flag might mask a real configuration problem.
//
// 1. Call the actual owning run operation with an unrecognized flag.
// 2. Assert exit code 2 and an unknown-flag diagnostic naming the authored flag.
//
// Testing: behavioral-verification --garbage-flag returns usage status two and a flag-provided-but-not-defined diagnostic naming garbage-flag.
// Testing: independent-expectations The deliberately unregistered garbage-flag independently owes flag-parser rejection; literal error category and authored flag name define the expected stderr without copying actual output.
// Testing: distinguishing-cases Status two alone also occurs for missing stdio; the unknown-flag category and garbage-flag name reject a fallthrough to that transport guard. Recognized cwd without stdio and accepted metadata aliases retain their separate cases.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestTtscserverCommandRejectsUnknownFlag(t *testing.T) {
  code, _, errOut := captureTtscserverCommand(t, "--garbage-flag")
  if code != 2 {
    t.Fatalf("expected exit 2 for unknown flag, got %d", code)
  }
  if !strings.Contains(errOut, "flag provided but not defined") || !strings.Contains(errOut, "garbage-flag") {
    t.Fatalf("expected unknown-flag diagnostic, got %q", errOut)
  }
}

// scenarioTestTtscserverCommandVersionAliases verifies every version spelling
// reports the same banner.
//
// Editors frequently log this output for support reports, so all aliases
// must resolve to the same banner. A spelling that diverged would produce
// inconsistent diagnostic metadata across editor configurations.
//
// 1. Call the actual owning run operation -v, --version, and version.
// 2. Assert each alias exits 0 and prints the ttscserver version banner.
//
// Testing: behavioral-verification -v, --version and version return zero with the ttscserver banner prefix.
// Testing: independent-expectations The native host metadata contract supplies the literal prefix independently of release version values.
// Testing: distinguishing-cases Three named metadata aliases run without stdio or a fixture project; help and transport cases are separate.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestTtscserverCommandVersionAliases(t *testing.T) {
  for _, flag := range []string{"-v", "--version", "version"} {
    t.Run(flag, func(t *testing.T) {
      code, out, errOut := captureTtscserverCommand(t, flag)
      if code != 0 {
        t.Fatalf("%s version alias failed: code=%d stderr=%q", flag, code, errOut)
      }
      if !strings.HasPrefix(strings.TrimSpace(out), "ttscserver ") {
        t.Fatalf("%s output missing version prefix:\n%s", flag, out)
      }
    })
  }
}

// captureTtscserverCommand observes actual dispatch with invocation-local stream buffers.
//
// Package writer seams are restored by defer on ordinary return and testing
// failure. Existing cwd/signal/host seams reject accidental startup before
// any native producer can run. Empty stdin has invocation-local ownership.
// All scenarios are sequential; no case uses t.Parallel. Buffers retain
// full bytes and do not substitute empty stderr for successful status.
//
// Common: Principled implementation: The actual run dispatcher writes into separate byte buffers; its returned status is preserved unchanged.
// Common: Clear and simple design: This helper owns only stream capture and seam restoration, leaving argv and all dispatch decisions with run; existing cwd, signal and host seams enforce the documented no-start boundary.
// Common: Prohibited implementation shortcuts: Existing package-owned writer seams are used without foreign mutation, production test branches, cached outcomes or retries.
// Common: Meaningful documentation: Native paragraphs state full-byte capture, deferred restoration and the sequential execution requirement.
func captureTtscserverCommand(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  previousOut, previousErr, previousIn := stdout, stderr, stdin
  previousGetwd, previousNotify, previousHost := getwd, notifyContext, runLSPServer
  defer func() {
    stdout, stderr, stdin = previousOut, previousErr, previousIn
    getwd, notifyContext, runLSPServer = previousGetwd, previousNotify, previousHost
  }()
  stdin = strings.NewReader("")
  getwd = func() (string, error) {
    t.Fatal("metadata or invalid invocation reached cwd resolution")
    return "", nil
  }
  notifyContext = func(ctx context.Context, signals ...os.Signal) (context.Context, context.CancelFunc) {
    t.Fatal("metadata or invalid invocation reached LSP startup")
    return ctx, func() {}
  }
  runLSPServer = func(context.Context, lspserver.LSPServerOptions) error {
    t.Fatal("metadata or invalid invocation started an LSP host")
    return nil
  }
  var output, errors bytes.Buffer
  stdout, stderr = &output, &errors
  code := run(args)
  return code, output.String(), errors.String()
}
