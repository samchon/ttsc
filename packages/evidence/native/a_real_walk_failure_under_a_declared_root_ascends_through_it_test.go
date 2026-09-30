package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a real walk failure under a declared root ascends through that root.
 *
 * `relativeProjectPath` answers relative to the base rather than to the project,
 * so a base above the project would otherwise print a path a reader cannot open
 * from where they are standing. Composing it through the base is what re-attaches
 * the root, and only a base that actually ascends proves it.
 *
 *  1. Root a Markdown reference above the project.
 *  2. Make a directory inside it unreadable and run the rule.
 *  3. Assert the failure ascends exactly as the file locations beside it do.
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn is exercised with the scenario below; the assertions require the failure ascends exactly as the file locations beside it do.
 * @evidence contracts/testing.md#independent-expectations `relativeProjectPath` answers relative to the base rather than to the project, so a base above the project would otherwise print a path a reader cannot open from where they are standing. Composing it through the base is what re-attaches the root, and only a base that actually ascends proves it.
 * @evidence contracts/testing.md#distinguishing-cases Root a Markdown reference above the project. Make a directory inside it unreadable and run the rule. Assert the failure ascends exactly as the file locations beside it do.
 * @evidence contracts/testing.md#execution-ownership TestARealWalkFailureUnderADeclaredRootAscendsThroughIt is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestARealWalkFailureUnderADeclaredRootAscendsThroughIt(t *testing.T) {
  workspace := t.TempDir()
  private := filepath.Join(workspace, "documents", "requirements", "private")
  if err := os.MkdirAll(private, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(private, "hidden.md"), []byte("## Hidden\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  unreadableDirectory(t, private)
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "documents/requirements/pricing.md": "## Discounts {#discounts}\n",
    "project/src/sale.ts":               "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertProblemContains(
    t,
    messages,
    "could not inspect '../documents/requirements/private':",
  )
}
