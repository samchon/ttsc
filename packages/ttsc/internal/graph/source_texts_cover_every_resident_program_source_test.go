package graph

import (
  "path/filepath"
  "strings"
  "testing"

  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestSourceTextsCoverEveryResidentProgramSource observes an authored outside
// declaration and the presence of at least one bundled library in SourceTexts.
// The declaration text is compared exactly; bundled content, every resident
// source, digest capabilities, and physical/checker byte identity are not
// authenticated by these selected observations.
//
//  1. Compile a project that calls a function declared by an outside `.d.ts`.
//  2. Build the graph and capture the resident program's source texts.
//  3. Assert both the outside declaration and a virtual bundled library are in
//     the checker-text manifest.
//
// @evidence contracts/testing.md#behavioral-verification Requires an external graph fact at the authored declaration path, its exact SourceTexts value, and at least one bundled:/// key. It does not enumerate all resident files, inspect bundled values, compute digests, or serialize a provenance manifest.
// @evidence contracts/testing.md#independent-expectations The expectations are literal: the graph must hold an external node declared in the outside dependency d.ts, SourceTexts must hold exactly the text export declare function external(): number; for that declaration path, and SourceTexts must hold at least one bundled:/// path. The bundled library's text is not compared with anything.
// @evidence contracts/testing.md#distinguishing-cases Compile a project that calls a function declared by an outside `.d.ts`; Build the graph and capture the resident program's source texts; Assert both the outside declaration and a virtual bundled library are in the checker-text manifest.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config, project source, and outside declaration files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Build and SourceTexts execute in this process, with the declaration expectation keyed by shimtspath.ResolvePath. No product CLI, installed dependency, emitted JavaScript evaluation, or digest consumer runs.
func TestSourceTextsCoverEveryResidentProgramSource(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
