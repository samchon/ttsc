package linthost

import (
  "path/filepath"
  "sort"
  "strconv"
  "testing"
)

func runMigratedNoMisusedPromisesContexts(t *testing.T, source string) ([]int, int, string, string) {
  t.Helper()
  root := seedLintProject(t, source)
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","strict":true,"noEmit":true,"rootDir":"src","lib":["ES2022","DOM","ESNext.Disposable"]},"files":["src/main.ts"]}`)
  writeFile(t, filepath.Join(root, "package.json"), `{"devDependencies":{"@ttsc/lint":"*"}}`)
  seedLintRules(t, root, map[string]string{"typescript/no-misused-promises": "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  rendered := noMisusedPromisesANSI.ReplaceAllString(stderr, "")
  lines := []int{}
  for _, match := range noMisusedPromisesRenderedDiagnostic.FindAllStringSubmatch(rendered, -1) {
    line, err := strconv.Atoi(match[1])
    if err != nil {
      t.Fatal(err)
    }
    lines = append(lines, line)
  }
  sort.Ints(lines)
  return lines, code, stdout, stderr
}
