package linthost

import "testing"

// TestCommandCheckCorpusReportsUnknownRuleNames preserves the corpus warning
// spelling and nonfatal status through the actual owning command front door.
//
// @evidence contracts/testing.md#behavioral-verification Direct check loads the original made-up-rule:error config and clean typed ok source, returns zero and prints the complete single unknown-rule warning with no stdout.
// @evidence contracts/testing.md#independent-expectations The literal unsupported rule cannot produce a finding; its full warning line, quoted name and trailing newline are the supported command warning contract, not an implementation-generated expectation.
// @evidence contracts/testing.md#distinguishing-cases An unknown error-severity rule still permits a clean project; removing that config entry yields the adjacent zero-warning control on the same source and compiler options.
// @evidence contracts/testing.md#execution-ownership Actual run(check) reads the original compiler/config/source fixture directly in one Go process. The native package-loading and ttsc-to-sidecar transport connection is retained by shared E2E, not inferred from this unit result. The shared seedCommandLintCorpusProject helper writes the original ES2022/commonjs/strict/rootDir/outDir/plugin/include compiler fixture plus this case's authored lint JSON and source into a separately owned temporary root.
func TestCommandCheckCorpusReportsUnknownRuleNames(t *testing.T) {
  root := seedCommandLintCorpusProject(t, `{"rules":{"made-up-rule":"error"}}`, "export const value: string = \"ok\";\n")
  args := []string{"check", "--cwd", root, "--noEmit", "--plugins-json", lintManifest(t)}
  code, stdout, stderr := captureCommandOutput(t, func() int { return run(args) })
  const warning = "@ttsc/lint: ignoring unknown rule \"made-up-rule\"\n"
  if code != 0 || stdout != "" || stderr != warning {
    t.Fatalf("original unknown corpus mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  seedLintRules(t, root, map[string]string{})
  code, stdout, stderr = captureCommandOutput(t, func() int { return run(args) })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("known-empty control mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
