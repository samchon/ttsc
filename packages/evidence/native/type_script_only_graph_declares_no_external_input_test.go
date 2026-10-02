package evidence

import (
  "testing"
)

/**
 * Verifies a graph citing only TypeScript declares no external input at all.
 *
 * TypeScript inventories are materialized from the Program the host already
 * watches. Declaring them again would add a second watcher per source file for
 * no freshness the host does not already provide, and the cost of that lands on
 * every consumer whose graph never mentions a document.
 *
 *  1. Configure a TypeScript claim citing a TypeScript reference.
 *  2. Publish the rule's project inputs.
 *  3. Assert the declaration is empty.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.ProjectInputs through declaredInputs is exercised with the scenario below; the assertions require the declaration is empty.
 * @evidence contracts/testing.md#independent-expectations TypeScript inventories are materialized from the Program the host already watches. Declaring them again would add a second watcher per source file for no freshness the host does not already provide, and the cost of that lands on every consumer whose graph never mentions a document.
 * @evidence contracts/testing.md#distinguishing-cases Configure a TypeScript claim citing a TypeScript reference. Publish the rule's project inputs. Assert the declaration is empty.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptOnlyGraphDeclaresNoExternalInput is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestTypeScriptOnlyGraphDeclaresNoExternalInput(t *testing.T) {
  inputs := declaredInputs(t, `{"claims":[{
    "type":"typescript",
    "files":["src/**"],
    "reference":{"type":"typescript","files":["src/api/**"],"symbol":"type"}
  }]}`)
  if len(inputs) != 0 {
    t.Fatalf("expected a TypeScript-only graph to declare nothing, got %v", inputs)
  }
}
