package graph

import (
  "path/filepath"
  "reflect"
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
// Two local interfaces differ in whether the function's documentation links to
// them. The native compiler must report the unlinked declaration unused and not
// the linked one. Build must expose the matching spanned edge and preserve the
// before/after rendered diagnostic list. This is the maintained compiler's
// report for one fixture, not an independent full compiler-semantics oracle.
//
//  1. Build one file declaring two types, using one only through a link and the
//     other not at all.
//  2. Assert the compiler reports the unlinked declaration unused and the linked one
//     not.
//  3. Assert the link produced its edge in the same build.
//
// @evidence contracts/testing.md#behavioral-verification Verifies the premise this edge rests on: the compiler resolves a documentation link and counts it as a use, and recording the edge does not change what it reports.
// @evidence contracts/testing.md#independent-expectations Authored IUnlinked must match an unused-declaration report while ILinked must not, and the literal subject-to-ILinked suffix pair must have exactly one doc-ref with a positive span. The compiler supplies the report; ID grammar and full language correctness are not independently certified. The before/after rendered report equality checks Build transparency, not the correctness of unrelated diagnostics.
// @evidence contracts/testing.md#distinguishing-cases Linked versus unlinked local interfaces contrast within one source. The positive unused control prevents an empty diagnostic set from satisfying the linked absence check; the spanned edge and unchanged rendered report are separately required after Build.
// @evidence contracts/testing.md#execution-ownership This graph Go source-unit writes its native temporary project, constructs and closes a driver compiler Program in-process, queries Diagnostics, and calls Build. A restored empty linked-plugin manifest excludes ambient hooks; no installed consumer or native product command is used.
func TestDocRefsAreTheUseTheCheckerAlreadyCounts(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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
  before := []string{}
  for _, diagnostic := range prog.Diagnostics() {
    message := diagnostic.String()
    before = append(before, message)
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

  graph := Build(prog)
  assertDocRef(t, graph, "#subject:function", "#ILinked:interface")
  after := []string{}
  for _, diagnostic := range prog.Diagnostics() {
    after = append(after, diagnostic.String())
  }
  if !reflect.DeepEqual(after, before) {
    t.Fatalf("Build changed the rendered diagnostic report: before %v, after %v", before, after)
  }
}
