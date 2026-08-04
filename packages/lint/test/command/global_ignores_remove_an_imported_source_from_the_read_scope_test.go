package linthost

import (
  "path/filepath"
  "testing"
)

// TestGlobalIgnoresRemoveAnImportedSourceFromTheReadScope verifies the widened
// read scope stays governed by the lint config.
//
// Admitting the TypeScript an import reached grows what a project reports, so a
// user needs the ordinary control over it. A global `ignores` entry marks the
// file Ignored during rule resolution, which drops it from a project rule's
// population and from the file walk alike. The case runs the same fixture twice
// so the silence it asserts is the ignore's doing: without the entry the very
// same imported file fails the command.
//
// 1. Import an unselected source carrying a no-var violation.
// 2. Run check with no-var enabled and assert the imported file fails it.
// 3. Add a global ignore for that file and assert the rerun is clean.
func TestGlobalIgnoresRemoveAnImportedSourceFromTheReadScope(t *testing.T) {
  root := seedLintProject(t, "import { value } from \"./extra\";\nJSON.stringify(value);\n")
  writeFile(
    t,
    filepath.Join(root, "src", "extra.ts"),
    "var legacy = 1;\nexport const value = legacy;\n",
  )
  seedLintRules(t, root, map[string]string{"no-var": "error"})

  code, _, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 2 || !diagnosticOutputContains(stderr, "[no-var]") {
    t.Fatalf("imported source did not report before the ignore: code=%d stderr=%q", code, stderr)
  }

  seedLintConfig(t, root, map[string]any{
    "ignores": []any{"src/extra.ts"},
    "rules":   map[string]any{"no-var": "error"},
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "check",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("ignored imported source still reported: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
