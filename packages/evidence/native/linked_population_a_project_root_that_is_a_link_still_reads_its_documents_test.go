package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies a project whose own root is a link still reads its documents.
 *
 * The default base is the one every population takes without declaring a
 * `root`, so a checkout reached through a link, which is how a package manager
 * and several CI images lay one out, emptied every Markdown and Prisma
 * population in the project without a single diagnostic. The walk root is
 * resolved for this base as well, and its addresses stay bare project-relative
 * paths, which is what every citation written before roots existed depends on.
 *
 *  1. Put the whole project behind a link and point the rule at the link.
 *  2. Leave a selected section uncited.
 *  3. Assert the document is found and named by its plain project-relative path.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot reads Markdown through a linked project root and names its missing Discounts target at docs/pricing.md line one.
 * @evidence contracts/testing.md#independent-expectations Literal missing target and project-relative line one verify materialization and display.
 * @evidence contracts/testing.md#distinguishing-cases One positive case: the project root is a link to a real directory and the selected Markdown section is uncited, so the reported target and its line-one location prove the documents were read and addressed by plain project-relative paths; no linked reference root, broken link or empty-population case runs here.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestAProjectRootThatIsALinkStillReadsItsDocuments(t *testing.T) {
	workspace := t.TempDir()
	real := filepath.Join(workspace, "real")
	if err := os.MkdirAll(real, 0o755); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(workspace, "project")
	if err := linkDirectory(real, link); err != nil {
		t.Fatalf("this platform refused to create a link: %v", err)
	}
	messages := runIndexRuleAtRoot(t, link, map[string]string{
		"docs/pricing.md": "## Discounts {#discounts}\n",
		"src/sale.ts":     "export interface ISale {}\n",
	}, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
	assertProblemContains(
		t,
		messages,
		"Missing acknowledgement for 'docs/pricing.md#discounts'",
	)
	assertProblemContains(t, messages, "at docs/pricing.md:1")
}
