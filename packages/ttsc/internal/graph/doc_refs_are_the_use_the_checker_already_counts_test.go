package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// unusedLocalsFixtureTSConfig is the shared fixture config with the one flag
// this test is about. `noUnusedLocals` is what makes the compiler state, in a
// diagnostic, whether it counted a documentation link as a use.
const unusedLocalsFixtureTSConfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "noUnusedLocals": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`

// TestDocRefsAreTheUseTheCheckerAlreadyCounts verifies the premise this edge
// rests on: the compiler resolves a documentation link and counts it as a use,
// and recording the edge does not change what it reports.
//
// The whole argument for the edge is that it is a compiler fact rather than a
// text match, and the compiler says so itself — an import supporting only a link
// survives `noUnusedLocals` while the same import without one does not. That
// asymmetry is the evidence the issue was opened on, and it lived only in its
// prose. Pinning it here matters twice: it fails if a TypeScript upgrade ever
// stops counting links as uses, which would make the edge a text match dressed
// as a checker fact, and it fails if this pass ever changes what the compiler
// reports, which it must never do.
//
//  1. Build one file importing two types, using one only through a link and the
//     other not at all.
//  2. Assert the compiler reports the unlinked import unused and the linked one
//     not.
//  3. Assert the link produced its edge in the same build.
func TestDocRefsAreTheUseTheCheckerAlreadyCounts(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), unusedLocalsFixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `interface ILinked {
  a: number;
}

interface IUnlinked {
  b: number;
}

/** Names {@link ILinked} and nothing else. */
export function subject(): void {}
`)

  prog, _, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()

  linked, unlinked := false, false
  for _, diagnostic := range prog.Diagnostics() {
    message := diagnostic.String()
    if !strings.Contains(message, "never used") &&
      !strings.Contains(message, "declared but") {
      continue
    }
    if strings.Contains(message, "ILinked") {
      linked = true
    }
    if strings.Contains(message, "IUnlinked") {
      unlinked = true
    }
  }
  if !unlinked {
    t.Fatal("the unlinked declaration was not reported unused, so this fixture " +
      "cannot demonstrate the asymmetry the edge rests on")
  }
  if linked {
    t.Fatal("the linked declaration was reported unused, so the compiler no " +
      "longer counts a documentation link as a use and this edge is a text " +
      "match rather than a checker fact")
  }

  // The same build produced the edge, so the fact the compiler counted and the
  // fact the graph records are one fact.
  assertDocRef(t, Build(prog), "#subject:function", "#ILinked:interface")
}
