package evidence

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies a TypeScript population matches a source through another nested link.
 *
 * A configured base may resolve through one link while the Program names the
 * same file through another below the project root. Comparing either the
 * declared base or only the base's resolved path to that source deactivates the
 * claim silently; both sides must resolve before one relative comparison.
 *
 *  1. Link two directories inside a project to one source directory.
 *  2. Root a claim at one link and parse its Program source through the other.
 *  3. Assert the claim owes its ordinary Markdown acknowledgement.
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check exercises the authored fixture. Assert the claim owes its ordinary Markdown acknowledgement.
 * @evidence contracts/testing.md#independent-expectations A configured base may resolve through one link while the Program names the same file through another below the project root. Comparing either the declared base or only the base's resolved path to that source deactivates the claim silently; both sides must resolve before one relative comparison. The authored scenario requires this outcome: Assert the claim owes its ordinary Markdown acknowledgement.
 * @evidence contracts/testing.md#distinguishing-cases Link two directories inside a project to one source directory. Root a claim at one link and parse its Program source through the other. Assert the claim owes its ordinary Markdown acknowledgement.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptPopulationMatchesAProgramSourceThroughANestedLink runs as a Go unit entry in the native package. graphRule.Check executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptPopulationMatchesAProgramSourceThroughANestedLink(t *testing.T) {
  workspace := t.TempDir()
  root := filepath.Join(workspace, "project")
  actual := filepath.Join(root, "sources", "actual")
  claimRoot := filepath.Join(root, "claim")
  programRoot := filepath.Join(root, "program")
  if err := os.MkdirAll(actual, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.MkdirAll(filepath.Join(root, "docs"), 0o755); err != nil {
    t.Fatal(err)
  }
  content := "export interface ISale { id: string; }\n"
  if err := os.WriteFile(filepath.Join(actual, "ISale.ts"), []byte(content), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(root, "docs", "spec.md"), []byte("# Spec\n\n## Sale\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  for _, link := range []string{claimRoot, programRoot} {
    if err := linkDirectory(actual, link); err != nil {
      t.Fatal(err)
    }
  }
  source := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{
      FileName: filepath.ToSlash(filepath.Join(programRoot, "ISale.ts")),
    },
    content,
    shimcore.ScriptKindTS,
  )
  reporter := &capturedProjectReporter{}
  graphRule{}.Check(rule.NewProjectContext(
    rule.ProjectIdentity{
      LogicalProjectRoot:  root,
      PhysicalProjectRoot: root,
    },
    []*shimast.SourceFile{source},
    nil,
    rule.SeverityError,
    json.RawMessage(`{"claims":[{
      "type":"typescript",
      "root":"claim",
      "files":["*.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    }]}`),
    reporter,
  ))
  if !strings.Contains(strings.Join(reporter.messages, "\n"), "Missing acknowledgement for 'docs/spec.md#sale'") {
    t.Fatalf("the nested source link did not reach the claim: %q", reporter.messages)
  }
}
