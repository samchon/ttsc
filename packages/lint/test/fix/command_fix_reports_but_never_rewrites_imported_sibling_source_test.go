package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFixReportsButNeverRewritesImportedSiblingSource verifies fix reads
// wider than it writes.
//
// The read scope covers a sibling workspace source the Program reached through
// an import, so its diagnostic must surface. The write side is the opposite
// half of that boundary: fix rewrites files, and a project must not rewrite a
// sibling package's sources merely because it imports them, so the identical
// violation is fixed in the consumer and left untouched next door
// (samchon/ttsc#1065). The package that owns the file fixes it from its own
// lint run, under its own config.
//
//  1. Put the same no-var violation in the consumer and in the sibling.
//  2. Run fix with no-var enabled.
//  3. Assert the consumer file was rewritten, the sibling file is byte-identical,
//     and the sibling diagnostic still failed the command.
func TestCommandFixReportsButNeverRewritesImportedSiblingSource(t *testing.T) {
  const siblingSource = "export var legacy = 1;\nexport const value = legacy;\n"
  consumer, sibling := seedLintSiblingSourceProject(
    t,
    "import { value } from \"../../api/src/index\";\nvar own = value;\nJSON.stringify(own);\n",
    siblingSource,
  )
  seedLintRules(t, consumer, map[string]string{"no-var": "error"})

  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "fix",
      "--cwd", consumer,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || stdout != "" {
    t.Fatalf("fix mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  if !diagnosticOutputContains(stderr, "[no-var]") ||
    !diagnosticOutputContains(stderr, "index.ts") {
    t.Fatalf("sibling diagnostic missing from stderr: %q", stderr)
  }

  assertFileText(
    t,
    filepath.Join(consumer, "src", "main.ts"),
    "import { value } from \"../../api/src/index\";\nlet own = value;\nJSON.stringify(own);\n",
  )
  got, err := os.ReadFile(sibling)
  if err != nil {
    t.Fatalf("ReadFile(%s): %v", sibling, err)
  }
  if string(got) != siblingSource {
    t.Fatalf("sibling source was rewritten:\nwant %q\ngot  %q", siblingSource, string(got))
  }
}
