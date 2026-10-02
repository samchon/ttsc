package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies a linked file inside the population is read like any other file.
 *
 * The twin of the directory case, and the reason the documentation cannot say
 * that links inside a population are simply not followed. `filepath.WalkDir`
 * hands a symbolic link to a file to the callback as an ordinary entry, the
 * globs match its name, and the read that follows resolves it. A reader told
 * otherwise would look for the missing acknowledgement somewhere else.
 *
 *  1. Put a document outside the population and link to it from inside.
 *  2. Leave it uncited.
 *  3. Assert the link's own path owes the acknowledgement.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn selects a Markdown heading from a linked file inside its population.
 * @evidence contracts/testing.md#independent-expectations The literal missing Discounts acknowledgement proves the linked file supplied a target.
 * @evidence contracts/testing.md#distinguishing-cases A file link is read while TestALinkInsideThePopulationIsNotFollowed forbids descending an internal directory link.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkedFileInsideThePopulationIsRead(t *testing.T) {
	workspace := t.TempDir()
	documents := filepath.Join(workspace, "documents", "requirements")
	if err := os.MkdirAll(documents, 0o755); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(workspace, "outside.md")
	if err := os.WriteFile(outside, []byte("## Discounts {#discounts}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := linkFile(t, outside, filepath.Join(documents, "pricing.md")); err != nil {
		t.Fatalf("this platform refused to link a file: %v", err)
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
}
