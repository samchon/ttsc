package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestCommandCheckCorpusIgnoresFutureOptionalFlags retains the native corpus
// argument pair through the real check command rather than only a flag helper.
// The malformed-source control proves the ignored option does not bypass checking.
//
// @evidence contracts/testing.md#behavioral-verification Actual run(check) accepts --future-optional-flag ignored-value with the original empty-rule config and typed future-flag source, retaining zero status and no output; a string/number type error still fails through the identical argument vector.
// @evidence contracts/testing.md#independent-expectations Unknown optional arguments are ignored under the forward-compatible command contract; assigning number one to a declared string independently requires TS2322 and status two even with those flags present.
// @evidence contracts/testing.md#distinguishing-cases The original clean case preserves explicit cwd, absolute tsconfig, plugin descriptor and unknown flag/value ordering; the type-error control distinguishes genuine flag tolerance from skipping compiler work.
// @evidence contracts/testing.md#execution-ownership Direct run(check) loads temporary original compiler/config/source inputs in one Go process. The native producer, loaded binary identity and process invocation remain the shared E2E owner's boundary; this selectable unit owns flag parsing and command execution semantics. The shared seedCommandLintCorpusProject helper writes the original ES2022/commonjs/strict/rootDir/outDir/plugin/include compiler fixture plus this case's authored lint JSON and source into a separately owned temporary root.
func TestCommandCheckCorpusIgnoresFutureOptionalFlags(t *testing.T) {
  root := seedCommandLintCorpusProject(t, `{"rules":{}}`, "export const value: string = \"future-flag\";\n")
  args := []string{
    "check", "--cwd", root,
    "--tsconfig", filepath.Join(root, "tsconfig.json"),
    "--plugins-json", lintManifest(t),
    "--future-optional-flag", "ignored-value",
  }
  code, stdout, stderr := captureCommandOutput(t, func() int { return run(args) })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("original future-flag corpus failed: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  writeFile(t, filepath.Join(root, "src", "main.ts"), "export const value: string = 1;\n")
  code, stdout, stderr = captureCommandOutput(t, func() int { return run(args) })
  if code != 2 || stdout != "" || !strings.Contains(stderr, "TS2322") {
    t.Fatalf("future flags bypassed type checking: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
