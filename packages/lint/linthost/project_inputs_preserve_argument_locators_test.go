package linthost

import (
  "os"
  "path/filepath"
  "slices"
  "testing"
)

// TestProjectInputsPreserveArgumentLocators verifies publisher inputs retain
// the names the compiler followed rather than only their current targets.
//
// 1. Select a response through an argument-base directory link outside the project.
// 2. Ask actual project-input dispatch for its pre-Program dependency declaration.
// 3. Require the base and response locators while project identity stays physical.
//
// @evidence contracts/testing.md#behavioral-verification Actual computeProjectInputs parses a response through a real directory link and must retain both lexical argument locators in Files and ReloadFiles, rather than only the current target paths.
// @evidence contracts/testing.md#independent-expectations Authored link and response names prescribe the locator spellings; native SameFile independently checks that the selected project root remains the project, not the argument directory.
// @evidence contracts/testing.md#distinguishing-cases Contrasts linked argument context with a separate physical project root; common invocation-context tests retain ordinary response edits and empty/null suppression. This case skips only when the actual filesystem cannot create the link.
// @evidence contracts/testing.md#execution-ownership One Go unit owns temporary response/config files, a directory link, restored transport variables and real in-process rule/input dispatch. Cleanup removes the link before its owning temporary directory; no compiler executable, consumer installation or fake filesystem is used.
func TestProjectInputsPreserveArgumentLocators(t *testing.T) {
  root := t.TempDir()
  project, base := filepath.Join(root, "project"), filepath.Join(root, "arguments")
  writeFile(t, filepath.Join(project, "tsconfig.json"), `{"files":["main.ts"]}`)
  writeFile(t, filepath.Join(project, "main.ts"), "export const value=1;\n")
  writeFile(t, filepath.Join(base, "args.rsp"), "--strict true\n")
  seedLintRules(t, project, map[string]string{"no-var": "error"})
  alias := filepath.Join(root, "alias")
  if err := os.Symlink(base, alias); err != nil {
    t.Skipf("filesystem refused directory symlink: %v", err)
  }
  t.Cleanup(func() { _ = os.Remove(alias) })
  t.Setenv(tsgoArgsEnv, `["@args.rsp"]`)
  t.Setenv(tsgoArgsCwdEnv, alias)
  snapshot, code := computeProjectInputs(&lspCommandOptions{cwd: project, tsconfig: "tsconfig.json", pluginsJSON: lintManifest(t)})
  if code != 0 {
    t.Fatal(code)
  }
  for _, paths := range [][]string{snapshot.Files, snapshot.ReloadFiles} {
    for _, required := range []string{alias, filepath.Join(alias, "args.rsp")} {
      if !slices.Contains(paths, filepath.ToSlash(required)) {
        t.Errorf("consumed locator %q missing from %v", required, paths)
      }
    }
  }
  selected, err := os.Stat(project)
  if err != nil {
    t.Fatal(err)
  }
  declared, err := os.Stat(filepath.FromSlash(snapshot.Root))
  if err != nil || !os.SameFile(selected, declared) {
    t.Fatalf("argument locator replaced project identity: %q / %v", snapshot.Root, err)
  }
}
