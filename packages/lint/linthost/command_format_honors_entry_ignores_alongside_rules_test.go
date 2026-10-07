package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFormatHonorsEntryIgnoresAlongsideRules verifies the in-process
// `ttsc format` command leaves a file alone when the active lint config entry
// has both a `rules` block and an `ignores` list that names it.
//
// This config object has no files selector, so its ignores list creates a
// global-ignore entry alongside the ordinary format/rule entry. ResolveRules
// returns Ignored for the matched source and the format resolver must preserve
// that exclusion. Removing only the ignores list permits the same source to
// gain semicolons. This does not isolate entry-scoped ignores under files.
//
//  1. Seed a project whose only source file is missing trailing semicolons.
//  2. Write a lint.config.json with one entry that has a `format` block,
//     a `rules` block, and an `ignores` glob naming that source file.
//  3. Run the format subcommand and assert the source file is untouched.
//  4. Run the same configuration without the `ignores` glob on a second copy
//     and assert the semicolons are added.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process format command on var plus an unterminated call with one authored config object containing format, rules and an ignores glob, without files. The matched globally ignored file remains byte-identical with status zero and empty streams; the no-ignore control gains both semicolons.
// @evidence contracts/testing.md#independent-expectations The expectation is the original literal source, which follows from the contract that an ignored file is not rewritten; nothing is derived from formatter output.
// @evidence contracts/testing.md#distinguishing-cases The ignored file stays unchanged (negative case) while the identical configuration without the ignores glob adds both semicolons (control), so the ignore alone separates the two outcomes.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project and JSON config; no child process, built binary or installed consumer.
func TestCommandFormatHonorsEntryIgnoresAlongsideRules(t *testing.T) {
  original := "var legacy = 1\nJSON.stringify(legacy)\n"
  root := seedLintProject(t, original)
  seedLintConfig(t, root, map[string]any{
    "ignores": []string{"src/main.ts"},
    "format": map[string]any{
      "semi": true,
    },
    "rules": map[string]string{
      "no-var": "error",
    },
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  if string(got) != original {
    t.Fatalf("ignored file was rewritten:\nwant %q\ngot  %q", original, string(got))
  }

  // Control: the same entry without the `ignores` glob does rewrite the file,
  // so the untouched result above comes from the ignore and not from a
  // formatter that never ran.
  controlRoot := seedLintProject(t, original)
  seedLintConfig(t, controlRoot, map[string]any{
    "format": map[string]any{"semi": true},
    "rules":  map[string]string{"no-var": "error"},
  })
  code, stdout, stderr = captureCommandOutput(t, func() int {
    return run([]string{
      "format",
      "--cwd", controlRoot,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("control format command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertFileText(t, filepath.Join(controlRoot, "src", "main.ts"), "var legacy = 1;\nJSON.stringify(legacy);\n")
}
