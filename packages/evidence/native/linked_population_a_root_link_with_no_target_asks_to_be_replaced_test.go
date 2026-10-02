package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies a root that is a link with no target asks to be replaced.
 *
 * `os.Stat` follows the link and reports the absent target, so the root reads as
 * missing and the repair is to create it. Something is already at that path, and
 * creating a directory over it fails, which is the unfollowable repair a file
 * occupying the path produces and the one this predicate exists to avoid.
 *
 *  1. Point a link at a directory and then remove the directory.
 *  2. Root a reference at the link and run the rule.
 *  3. Assert the diagnostic asks for a replacement rather than a creation.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn reports a dangling Markdown root and requests replacement with a directory.
 * @evidence contracts/testing.md#independent-expectations The fixture removes the target and the literal not-directory and replacement messages are authored failure expectations.
 * @evidence contracts/testing.md#distinguishing-cases One negative case: a link that existed with a real target is left dangling by removing the target, and the "not a directory"/replace wording is asserted; the absent-path "create that directory" wording and a healthy linked root are not exercised in this body.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestARootLinkWithNoTargetAsksToBeReplaced(t *testing.T) {
	workspace := t.TempDir()
	target := filepath.Join(workspace, "target")
	if err := os.MkdirAll(target, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := linkDirectory(t, target, filepath.Join(workspace, "documents")); err != nil {
		t.Fatalf("this platform refused to create a link: %v", err)
	}
	if err := os.Remove(target); err != nil {
		t.Fatal(err)
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
	assertProblemContains(t, messages, "because that path is not a directory")
	assertProblemContains(
		t,
		messages,
		"replace that path with a directory and the markdown sources it should hold",
	)
}
