package evidence

import (
	"testing"
)

/**
 * Verifies a population rooted at a link materializes the documents behind it.
 *
 * `baseDirectoryProblem` stats the root, which follows a link and finds a
 * directory, so the root is accepted. `filepath.WalkDir` lstats it, which does
 * not, so the walk descended into nothing and the population came back healthy
 * and empty over documents that were there. The two checks have to agree, and a
 * linked directory is the ordinary shape of a shared requirements set in a
 * workspace a package manager installed.
 *
 *  1. Put the documents behind a link and root a reference at the link.
 *  2. Cite one of its sections.
 *  3. Assert the graph closes.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn accepts the authored ISale citation to a heading behind a linked Markdown root.
 * @evidence contracts/testing.md#independent-expectations No diagnostics is the authored valid citation outcome; this case alone does not count materialized targets.
 * @evidence contracts/testing.md#distinguishing-cases A linked declared root differs from an internal link the walker must not descend, owned by TestALinkInsideThePopulationIsNotFollowed.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkedMarkdownRootMaterializesItsDocuments(t *testing.T) {
	workspace := t.TempDir()
	writeLinkedDocuments(t, workspace, map[string]string{
		"requirements/pricing.md": "## Discounts {#discounts}\n",
	})
	messages := runRootedGraphIn(t, workspace, map[string]string{
		"project/src/sale.ts": "/** @evidence requirements/pricing.md#discounts Discount rules follow this section. */\n" +
			"export interface ISale {}\n",
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
	assertNoProblems(t, messages)
}
