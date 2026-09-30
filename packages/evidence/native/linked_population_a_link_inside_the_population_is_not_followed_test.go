package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies a link inside the population is still not followed.
 *
 * The negative twin of the repair, and the property it could most easily
 * overrun. Only the base moves: `filepath.WalkDir` does not descend into a link
 * it meets during the walk, and a population that silently absorbed one would
 * take in documents no glob under the declared root reaches and hand them
 * addresses through a directory that is not the base.
 *
 *  1. Put one document under the root and one behind a link inside it.
 *  2. Leave both uncited.
 *  3. Assert only the document under the root owes an acknowledgement.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn keeps the visible Discounts reference and excludes Secret under an internal linked directory.
 * @evidence contracts/testing.md#independent-expectations The literal Discounts diagnostic plus absence of secret independently specify the walker boundary.
 * @evidence contracts/testing.md#distinguishing-cases A directory link encountered within a population differs from a link naming its declared root.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkInsideThePopulationIsNotFollowed(t *testing.T) {
	workspace := t.TempDir()
	hidden := filepath.Join(workspace, "hidden")
	if err := os.MkdirAll(hidden, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(hidden, "secret.md"),
		[]byte("## Secret {#secret}\n"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	documents := filepath.Join(workspace, "documents")
	if err := os.MkdirAll(filepath.Join(documents, "requirements"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(documents, "requirements", "pricing.md"),
		[]byte("## Discounts {#discounts}\n"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := linkDirectory(hidden, filepath.Join(documents, "requirements", "linked")); err != nil {
		t.Fatalf("this platform refused to create a link: %v", err)
	}
	messages := runRootedGraphIn(t, workspace, map[string]string{
		"project/src/sale.ts": "export interface ISale {}\n",
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
		"Missing acknowledgement for 'requirements/pricing.md#discounts'",
	)
	if countProblemsContaining(messages, "secret") != 0 {
		t.Fatalf("a link met during the walk is not descended into")
	}
}
