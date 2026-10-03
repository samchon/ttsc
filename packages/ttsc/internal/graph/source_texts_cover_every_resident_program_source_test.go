package graph

import (
  "path/filepath"
  "strings"
  "testing"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestSourceTextsCoverEveryResidentProgramSource verifies that snapshot
// evidence includes every class of source the checker loaded.
//
// External graph leaves still carry checker-derived facts and spans. Omitting
// their resident text from the source manifest leaves those facts without the
// byte identity that the sourceDigests capability promises. Virtual bundled
// libraries need the same checker digest even though they have no disk digest.
//
//  1. Compile a project that calls a function declared by an outside `.d.ts`.
//  2. Build the graph and capture the resident program's source texts.
//  3. Assert both the outside declaration and a virtual bundled library are in
//     the checker-text manifest.
//
// @evidence contracts/testing.md#behavioral-verification Verifies that snapshot evidence includes every class of source the checker loaded.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: the graph must hold an external node declared in the outside dependency d.ts, SourceTexts must hold exactly the text export declare function external(): number; for that declaration path, and SourceTexts must hold at least one bundled:/// path. The bundled library's text is not compared with anything.
// @evidence contracts/testing.md#distinguishing-cases Compile a project that calls a function declared by an outside `.d.ts`; Build the graph and capture the resident program's source texts; Assert both the outside declaration and a virtual bundled library are in the checker-text manifest.
// @evidence contracts/testing.md#execution-ownership TestSourceTextsCoverEveryResidentProgramSource is a Go source-unit entry. Build, SourceTexts execute directly over the authored source or explicit input facts. The owning operations stay in this test process, without installing a consumer or building or starting a native product binary.
func TestSourceTextsCoverEveryResidentProgramSource(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "app")
  declaration := filepath.Join(workspace, "dependency", "index.d.ts")
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { external } from "../../dependency";

export const value = external();
`)
  writeFile(t, declaration, `export declare function external(): number;
`)
  declaration = shimtspath.ResolvePath(declaration)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  built := Build(prog)
  hasExternalFact := false
  for _, node := range built.Nodes {
    if node.External && node.File == declaration {
      hasExternalFact = true
      break
    }
  }
  if !hasExternalFact {
    t.Fatalf("graph has no external fact from %s", declaration)
  }

  texts := SourceTexts(prog)
  if got, ok := texts[declaration]; !ok || got != "export declare function external(): number;\n" {
    t.Fatalf("declaration source text = %q, present %v", got, ok)
  }
  hasBundledSource := false
  for path := range texts {
    if strings.HasPrefix(path, "bundled:///") {
      hasBundledSource = true
      break
    }
  }
  if !hasBundledSource {
    t.Fatal("source manifest has no virtual bundled library")
  }
}
