package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies a walker rooted inside a link is unchanged by the same repair.
 *
 * The two walkers were never affected: they generate every path they compare
 * from the base they were handed, so a linked ancestor is transparent to them in
 * the way the filesystem intends. The repair moves what the base resolves to, and
 * this is the negative twin that says their addressing did not move with it.
 *
 *  1. Root a Markdown reference at a path inside a linked directory.
 *  2. Leave its section uncited.
 *  3. Assert the location is spelled through the declared root, not the link's
 *     target.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn reports a Markdown heading and its authored location through a linked ancestor.
 * @evidence contracts/testing.md#independent-expectations Literal Discounts identity and ../mirror/documents/requirements/pricing.md line one independently pin selection and display.
 * @evidence contracts/testing.md#distinguishing-cases A link above the root leaf must not deactivate the population or replace its diagnostic spelling.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestAMarkdownRootInsideALinkIsUnchanged(t *testing.T) {
	workspace := t.TempDir()
	documents := filepath.Join(workspace, "documents", "requirements")
	if err := os.MkdirAll(documents, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(documents, "pricing.md"),
		[]byte("## Discounts {#discounts}\n"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := linkDirectory(t, workspace, filepath.Join(workspace, "mirror")); err != nil {
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
      "root":"../mirror/documents",
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
	assertProblemContains(
		t,
		messages,
		"Missing acknowledgement for 'requirements/pricing.md#discounts'",
	)
	assertProblemContains(t, messages, "at ../mirror/documents/requirements/pricing.md:1")
}
