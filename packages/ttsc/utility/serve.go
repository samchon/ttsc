package utility

import (
  "fmt"
  "os"
  "path/filepath"
  "strings"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// RunServe is the per-file emit host ttsx spawns for projects with no
// transform-stage plugin. It serves plain tsgo emit (no rewrites) over the same
// stdio protocol the plugin hosts use, so ttsx's loader treats plugin and
// plugin-less projects identically. RunEmitServer holds one program per owning
// tsconfig and calls plainEmitFile for each requested source file.
func RunServe(args []string) int {
  _ = args
  cwd, err := os.Getwd()
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility serve: cwd: %v\n", err)
    return 2
  }
  if err := driver.RunEmitServer(os.Stdin, os.Stdout, cwd, plainEmitFile); err != nil {
    fmt.Fprintf(os.Stderr, "ttsc utility serve: %v\n", err)
    return 1
  }
  return 0
}

// plainEmitFile emits one source file through its owning program with no
// transform rewrites — the same JavaScript a plain `ttsc build` writes. One
// EmitFile call maps exactly one source to its output, so the loader needs no
// output-to-source remapping.
func plainEmitFile(prog *driver.Program, _, _, file string) (string, error) {
  target := prog.SourceFile(file)
  if target == nil {
    return "", fmt.Errorf("source file is not in program: %s", file)
  }
  captured := ""
  produced := false
  _, _, err := prog.EmitFile(driver.NewRewriteSet(), target, func(name, text string, _ *shimcompiler.WriteFileData) error {
    if isJavaScriptOutput(name) {
      captured = text
      produced = true
    }
    return nil
  })
  if err != nil {
    return "", err
  }
  if !produced {
    return "", fmt.Errorf("no JavaScript produced for %s", file)
  }
  return captured, nil
}

// isJavaScriptOutput reports whether an emitted file name is the JavaScript the
// loader runs. tsgo emits `.js` for `.ts`/`.tsx`, `.cjs` for `.cts`, and `.mjs`
// for `.mts`; declaration and map outputs are ignored.
func isJavaScriptOutput(name string) bool {
  lower := strings.ToLower(filepath.ToSlash(name))
  for _, suffix := range []string{".js", ".cjs", ".mjs", ".jsx"} {
    if strings.HasSuffix(lower, suffix) {
      return true
    }
  }
  return false
}
