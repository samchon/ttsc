package evidence

import (
  "encoding/json"
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  "github.com/samchon/ttsc/packages/lint/rule"
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a linked source outside a TypeScript base is not a claim host.
 *
 * A Program can spell an external file through a link below the project. A
 * lexical containment check admitted it to a source glob below `src`, even though the
 * physical source is outside the declared base. A host with no citation then
 * acquired an obligation the population did not own.
 *
 *  1. Cite a Markdown section from an ordinary project source.
 *  2. Parse another source through a project link to an external directory.
 *  3. Assert the external source adds no host obligation.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check exercises the authored fixture. Assert the external source adds no host obligation.
 * @evidence contracts/testing.md#independent-expectations A Program can spell an external file through a link below the project. A lexical containment check admitted it to a source glob below `src`, even though the physical source is outside the declared base. A host with no citation then acquired an obligation the population did not own. The authored scenario requires this outcome: Assert the external source adds no host obligation.
 * @evidence contracts/testing.md#distinguishing-cases The Program holds an in-project source that cites the only section and a second source reached through a link to a directory outside the project. The reference sets singleEvidencePerSymbol, so a selected uncited host such as IExternal would be reported; the expected result is zero reported messages. No contrasting case with an uncited in-project source or a link that stays inside the root is run here, so the silence also fits a claim that selected nothing.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptPopulationExcludesAProgramSourceLinkedOutsideItsRoot runs as a Go unit entry in the native package. graphRule.Check executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptPopulationExcludesAProgramSourceLinkedOutsideItsRoot(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  outside := filepath.Join(workspace, "outside")
  for _, directory := range []string{
    filepath.Join(root, "src"),
    filepath.Join(root, "docs"),
    outside,
  } {
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  if err := os.WriteFile(filepath.Join(root, "docs", "spec.md"), []byte("# Spec\n\n## Sale\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(outside, "External.ts"), []byte("export interface IExternal {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  link := filepath.Join(root, "src", "linked")
  if err := linkDirectory(t, outside, link); err != nil {
    t.Fatal(err)
  }
  parse := func(name string, content string) *shimast.SourceFile {
    return shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: filepath.ToSlash(name)},
      content,
      shimcore.ScriptKindTS,
    )
  }
  sources := []*shimast.SourceFile{
    parse(filepath.Join(root, "src", "main.ts"),
      "/** @evidence docs/spec.md#sale Implements the sale contract. */\nexport interface IMain {}\n"),
    parse(filepath.Join(link, "External.ts"), "export interface IExternal {}\n"),
  }
  reporter := &capturedProjectReporter{}
  graphRule{}.Check(rule.NewProjectContext(
    rule.ProjectIdentity{
      LogicalProjectRoot:  root,
      PhysicalProjectRoot: root,
    },
    sources,
    nil,
    rule.SeverityError,
    json.RawMessage(`{"claims":[{
      "type":"typescript",
      "files":["src/**/*.ts"],
      "symbol":"type",
      "reference":{
        "type":"markdown",
        "files":["docs/**/*.md"],
        "symbol":"h2",
        "singleEvidencePerSymbol":true
      }
    }]}`),
    reporter,
  ))
  if len(reporter.messages) != 0 {
    t.Fatalf("a source outside the base became a claim host: %q", reporter.messages)
  }
}
