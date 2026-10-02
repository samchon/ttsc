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
 * Verifies a TypeScript claim selects its sources when the Program spells them
 * through the logical project root while the rule anchors the physical one.
 *
 * A host opens the Program from the directory it was handed. `ttsc` hands the
 * physical project root, but an editor and a graph session hand the one they
 * were started in, which reaches the project through a link on macOS, whose
 * temporary directory sits below the `/var` link, and in any linked checkout.
 * The claim's population compared the Program's spelling against the physical
 * root alone, found no source below it, and deactivated: the rule passed
 * without checking anything, and published no artifact to the graph.
 *
 *  1. Link a directory to a project, and parse its source through the link.
 *  2. Evaluate a claim whose source cites nothing, with the physical root and
 *     the linked one as the project's two roots.
 *  3. Assert the missing acknowledgement is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check exercises the authored fixture. Assert the missing acknowledgement is reported.
 * @evidence contracts/testing.md#independent-expectations A host opens the Program from the directory it was handed. `ttsc` hands the physical project root, but an editor and a graph session hand the one they were started in, which reaches the project through a link on macOS, whose temporary directory sits below the `/var` link, and in any linked checkout. The claim's population compared the Program's spelling against the physical root alone, found no source below it, and deactivated: the rule passed without checking anything, and published no artifact to the graph. The authored scenario requires this outcome: Assert the missing acknowledgement is reported.
 * @evidence contracts/testing.md#distinguishing-cases Link a directory to a project, and parse its source through the link. Evaluate a claim whose source cites nothing, with the physical root and the linked one as the project's two roots. Assert the missing acknowledgement is reported.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptPopulationMatchesAProgramOpenedThroughTheLogicalRoot runs as a Go unit entry in the native package. graphRule.Check executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptPopulationMatchesAProgramOpenedThroughTheLogicalRoot(t *testing.T) {
  workspace := t.TempDir()
  physical := filepath.Join(workspace, "physical")
  logical := filepath.Join(workspace, "logical")
  files := map[string]string{
    "docs/spec.md": "# Spec\n\n## Sale\n\nA sale.\n",
    "src/ISale.ts": "export interface ISale {\n  id: string;\n}\n",
  }
  for relative, content := range files {
    absolute := filepath.Join(physical, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  if err := linkDirectory(t, physical, logical); err != nil {
    t.Fatal(err)
  }
  source := shimparser.ParseSourceFile(
    shimast.SourceFileParseOptions{
      FileName: filepath.ToSlash(filepath.Join(logical, "src", "ISale.ts")),
    },
    files["src/ISale.ts"],
    shimcore.ScriptKindTS,
  )
  reporter := &capturedProjectReporter{}
  graphRule{}.Check(rule.NewProjectContext(
    rule.ProjectIdentity{
      LogicalProjectRoot:  logical,
      PhysicalProjectRoot: physical,
    },
    []*shimast.SourceFile{source},
    nil,
    rule.SeverityError,
    json.RawMessage(`{"claims":[{
      "type":"typescript",
      "files":["src/**/*.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
    }]}`),
    reporter,
  ))
  if !strings.Contains(strings.Join(reporter.messages, "\n"), "Missing acknowledgement for 'docs/spec.md#sale'") {
    t.Fatalf("the claim did not evaluate a source spelled through the logical root: %q", reporter.messages)
  }
}
