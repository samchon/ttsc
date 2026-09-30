//go:build windows

package evidence

import (
  "os"
  "path/filepath"
  "regexp"
  "strings"
  "testing"
)

/**
 * Verifies a project root alias cannot change an unchanged code review.
 *
 * Canonicalizing a file against an authored root leaks the checkout directory
 * into its ID when a junction, symlink, or Windows short name aliases the root.
 *
 * 1. Obtain a review fingerprint through the physical project directory.
 * 2. Apply it through linked/nested roots and a relocated project directory.
 * 3. Verify both accept it and an implementation edit still expires the review.
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot obtains a physical-root review token; linked-root, relocated-root and forwarded-reference runs must stay clean, then a value edit must become stale.
 * @evidence contracts/testing.md#independent-expectations A declaration review is independent of the project-root spelling and changes with cited content. Its initial token is read from production diagnostics, so exact digest correctness is not independently checked.
 * @evidence contracts/testing.md#distinguishing-cases Physical, linked, relocated and forwarded contexts challenge path contamination; value 1 to 2 exercises expiry. Platform link setup may limit execution.
 * @evidence contracts/testing.md#execution-ownership TestWindowsFileLinkFingerprintsIgnoreProjectRootAliases is the Windows-only Go entry in the installed-SDK kernel population. It creates real NTFS junctions through linkWindowsPopulationDirectory and executes the original rule and snapshot checks in the shared Go process.
 * @evidence contracts/e2e.md#necessary-boundary Actual cmd.exe junction creation connects NTFS alias paths to the native rule resolver and parsed source snapshots; a hand-built inventory cannot establish this traversal and path-identity behavior.
 * @evidence contracts/e2e.md#shared-execution The Windows kernel population shares its already installed candidate SDK and Go process. This entry creates only its private junction/source fixture and reuses the original helpers; it adds no per-case SDK install or compiler build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns this entry's physical and logical paths. Junction aliases and the original sequential source rewrites remain within that private tree; local review tokens are reused only while the cited declaration snapshot stays equivalent.
 * @evidence contracts/e2e.md#preserved-coverage This Windows counterpart retains every original input, state transition and assertion from TestFileLinkFingerprintsIgnoreProjectRootAliases; only the selectable name and symbolic-link fixture producer change. The original portable symbolic-link unit remains separately selectable on supported unit hosts.
 */
func TestWindowsFileLinkFingerprintsIgnoreProjectRootAliases(t *testing.T) {
  workspace := t.TempDir()
  physical, linked := filepath.Join(workspace, "physical"), filepath.Join(workspace, "linked")
  if err := os.MkdirAll(physical, 0755); err != nil {
    t.Fatal(err)
  }
  if err := linkWindowsPopulationDirectory(physical, linked); err != nil {
    t.Fatal(err)
  }
  files := map[string]string{"api/value.ts": "export const value = 1;", "review.md": "## Review\n<!-- @link api/value.ts#value Reads the value. -->\n"}
  config := `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","files":["api/value.ts"],"symbol":"property","requireReview":true}}]}`
  messages := runIndexRuleAtRoot(t, physical, files, config)
  match := regexp.MustCompile(` #([0-9a-f]{7}) `).FindStringSubmatch(strings.Join(messages, "\n"))
  if len(match) != 2 {
    t.Fatalf("expected a review fingerprint: %v", messages)
  }
  files["review.md"] += "<!-- @evidenceReview api/value.ts#value #" + match[1] + " Checked the initializer. -->\n"
  assertNoProblems(t, runIndexRuleAtRoot(t, linked, files, config))
  assertNoProblems(t, runIndexRule(t, files, config))
  if err := linkWindowsPopulationDirectory(filepath.Join(linked, "api"), filepath.Join(physical, "forwarded")); err != nil {
    t.Fatal(err)
  }
  rooted := `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"forwarded","files":["value.ts"],"symbol":"property","requireReview":true}}]}`
  assertNoProblems(t, runIndexRuleAtRoot(t, linked, files, rooted))
  files["api/value.ts"] = "export const value = 2;"
  assertProblemContains(t, runIndexRuleAtRoot(t, linked, files, config), "Stale @evidenceReview")
}
