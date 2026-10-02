package main

import (
  "bytes"
  "strings"
  "testing"
)

// TestPlatformCommandOperationFamilies verifies the command's metadata and invalid invocation operations directly.
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
func TestPlatformCommandOperationFamilies(t *testing.T) {
  t.Run("TestCommandPrintsHelpAliases", scenarioTestCommandPrintsHelpAliases)
  t.Run("TestCommandPrintsHelpWithoutArgs", scenarioTestCommandPrintsHelpWithoutArgs)
  t.Run("TestCommandPrintsVersion", scenarioTestCommandPrintsVersion)
  t.Run("TestCommandRefusesCompilerCommands", scenarioTestCommandRefusesCompilerCommands)
  t.Run("TestCommandRejectsUnknown", scenarioTestCommandRejectsUnknown)
}

// scenarioTestCommandPrintsHelpAliases verifies explicit help commands share usage output.
//
// The helper exposes help aliases so users and package smoke scripts can ask
// for metadata without depending on the JavaScript launcher. Each alias must
// return before any compiler command is considered.
//
// This scenario protects the switch branch that handles -h, --help, and help.
// The assertions focus on the helper-specific usage text because compiler
// guidance belongs to the JavaScript ttsc and ttsx commands.
//
// 1. Invoke each documented help alias through the direct run helper.
// 2. Capture stdout and stderr for every alias.
// 3. Assert success, empty stderr, the version usage fragment and no demo text.
//
// Testing: behavioral-verification -h, --help and help return zero, empty stderr and ttsc --version text without demo.
// Testing: independent-expectations The platform helper metadata surface defines its usage line independently of full compiler commands.
// Testing: distinguishing-cases All three explicit aliases differ from the empty-argv usage case and the rejected build/check branches.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestCommandPrintsHelpAliases(t *testing.T) {
  for _, argument := range []string{"-h", "--help", "help"} {
    t.Run(argument, func(t *testing.T) {
      code, stdout, stderr := capturePlatformCommand(t, argument)
      if code != 0 || stderr != "" || !strings.Contains(stdout, "ttsc --version") || strings.Contains(stdout, "demo") {
        t.Fatalf("help alias %q mismatch: code=%d stdout=%q stderr=%q", argument, code, stdout, stderr)
      }
    })
  }
}

// scenarioTestCommandPrintsHelpWithoutArgs verifies the empty platform command prints usage.
//
// The per-platform helper is not the compiler front door. When a package smoke
// check starts it without arguments, the binary should explain the helper role
// instead of attempting project discovery or delegating to the JavaScript CLI.
//
// This scenario covers the no-args dispatch branch directly. It keeps the
// compatibility helper's default behavior stable for package managers that run
// installed binaries as a quick health check.
//
// 1. Invoke run with an empty argument slice.
// 2. Capture the helper stdout and stderr writers.
// 3. Assert a successful status and platform helper usage text.
//
// Testing: behavioral-verification Empty argv returns zero, empty stderr and the ttsc platform helper. usage fragment.
// Testing: independent-expectations The metadata-only platform helper documents its role instead of attempting compiler project discovery.
// Testing: distinguishing-cases The no-argument branch differs from explicit help aliases and unsupported commands.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestCommandPrintsHelpWithoutArgs(t *testing.T) {
  code, stdout, stderr := capturePlatformCommand(t)
  if code != 0 || stderr != "" || !strings.Contains(stdout, "ttsc platform helper.") {
    t.Fatalf("empty command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}

// scenarioTestCommandPrintsVersion verifies the platform helper reports build metadata.
//
// Version output is the only metadata path owned by the platform package. It
// must stay project-free so package installation checks can identify the helper
// binary even when no TypeScript project exists.
//
// This scenario covers the version dispatch branch and its alias forms. The
// assertion checks helper branding, commit metadata, and Go runtime metadata
// without depending on a release build's ldflags.
//
// 1. Invoke each documented version alias through the direct run helper.
// 2. Capture stdout and stderr for every alias.
// 3. Assert successful status and version metadata text.
//
// Testing: behavioral-verification -v, --version and version return zero, empty stderr and platform helper, commit and go metadata.
// Testing: independent-expectations Metadata field presence follows the helper contract without assuming release ldflags or exact versions.
// Testing: distinguishing-cases Three aliases exercise project-free version dispatch; help and command refusal have separate entries.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestCommandPrintsVersion(t *testing.T) {
  for _, argument := range []string{"-v", "--version", "version"} {
    t.Run(argument, func(t *testing.T) {
      code, stdout, stderr := capturePlatformCommand(t, argument)
      if code != 0 || stderr != "" ||
        !strings.Contains(stdout, "ttsc platform helper") ||
        !strings.Contains(stdout, "commit") ||
        !strings.Contains(stdout, "go ") {
        t.Fatalf("version alias %q mismatch: code=%d stdout=%q stderr=%q", argument, code, stdout, stderr)
      }
    })
  }
}

// scenarioTestCommandRefusesCompilerCommands verifies build and check stay outside the helper.
//
// The platform package is a metadata and smoke-test binary, not the compiler
// host. Build and check must tell callers to use the JavaScript ttsc CLI or a
// plugin-selected sidecar instead of trying to inspect a consumer project here.
//
// This scenario covers both labels in the shared build/check refusal branch.
// The diagnostic mentions typescript because that boundary is the reason these
// commands are owned by the JavaScript launcher.
//
// 1. Invoke build and check through the direct run helper.
// 2. Capture stdout and stderr for each command.
// 3. Assert command-error status and the JavaScript CLI refusal message.
//
// Testing: behavioral-verification build and check each return status two, empty stdout and JavaScript-CLI guidance mentioning the command and typescript.
// Testing: independent-expectations The platform helper owns metadata rather than compiler execution; both compiler labels must be refused.
// Testing: distinguishing-cases Two rejected compiler command labels differ from a wholly unknown label and accepted metadata commands.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestCommandRefusesCompilerCommands(t *testing.T) {
  for _, command := range []string{"build", "check"} {
    t.Run(command, func(t *testing.T) {
      code, stdout, stderr := capturePlatformCommand(t, command)
      if code != 2 || stdout != "" ||
        !strings.Contains(stderr, command+" is provided by the JavaScript ttsc CLI") ||
        !strings.Contains(stderr, "typescript") {
        t.Fatalf("%s refusal mismatch: code=%d stdout=%q stderr=%q", command, code, stdout, stderr)
      }
    })
  }
}

// scenarioTestCommandRejectsUnknown verifies unsupported platform commands fail clearly.
//
// Unknown commands must stop in the platform helper wrapper. Falling through to
// compiler behavior would blur the package boundary and make this binary look
// like the full JavaScript ttsc command.
//
// This scenario covers the default dispatch branch. The error text includes the
// unsupported command and points callers back to the JavaScript CLI help path.
//
// 1. Invoke a deliberately unsupported command name.
// 2. Capture the helper stdout and stderr writers.
// 3. Assert command-error status and the unknown-command diagnostic.
//
// Testing: behavioral-verification demo returns status two, empty stdout and an unknown-command diagnostic pointing to JavaScript CLI help.
// Testing: independent-expectations The helper command contract rejects unsupported labels with an actionable usage error.
// Testing: distinguishing-cases An unknown command differs from the explicit build/check refusal branches and accepted help/version.
// Testing: Execution ownership: The aggregate registers this original case name and calls actual private run in the owning command package, with no native artifact, Node process, compiler Program or project fixture. This private scenario is reviewed through its public aggregate because Go Evidence cannot select it.
func scenarioTestCommandRejectsUnknown(t *testing.T) {
  code, stdout, stderr := capturePlatformCommand(t, "demo")
  if code != 2 || stdout != "" ||
    !strings.Contains(stderr, `unknown command "demo"`) ||
    !strings.Contains(stderr, `run "ttsc --help" through the JavaScript CLI`) {
    t.Fatalf("unknown command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}

// capturePlatformCommand observes actual dispatch with invocation-local stream buffers.
//
// Package writer seams are restored by defer on ordinary return and testing
// failure. All scenarios are sequential; no case uses t.Parallel. Buffers retain
// full bytes and do not substitute empty stderr for successful status.
//
// Common: Principled implementation: The actual run dispatcher writes into separate byte buffers; its returned status is preserved unchanged.
// Common: Clear and simple design: This helper owns only stream capture and seam restoration, leaving argv and all dispatch decisions with run.
// Common: Prohibited implementation shortcuts: Existing package-owned writer seams are used without foreign mutation, production test branches, cached outcomes or retries.
// Common: Meaningful documentation: Native paragraphs state full-byte capture, deferred restoration and the sequential execution requirement.
func capturePlatformCommand(t *testing.T, args ...string) (int, string, string) {
  t.Helper()
  previousOut, previousErr := stdout, stderr
  defer func() { stdout, stderr = previousOut, previousErr }()
  var output, errors bytes.Buffer
  stdout, stderr = &output, &errors
  code := run(args)
  return code, output.String(), errors.String()
}
