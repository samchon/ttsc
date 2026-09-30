package evidence

import "testing"

/**
 * Verifies an unreadable Markdown root cannot become inactive.
 *
 * No files match when the root cannot be opened, but that absence is not a
 * healthy empty population. The claim remains active so the root problem
 * produced by the claim-side loader is reported, and the loader's own record of
 * the failed base is what activation reads to tell the two apart. Handing this
 * an empty map would test a state the loader cannot hand it.
 *
 *  1. Resolve a Markdown claim against a missing root.
 *  2. Record the population failure the claim-side loader records.
 *  3. Assert the unreadable claim remains active for diagnosis.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification activeGraphConfig with a recorded Markdown population failure exercises this case: Verifies an unreadable Markdown root cannot become inactive. The original assertions check assert the unreadable claim remains active for diagnosis.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations No files match when the root cannot be opened, but that absence is not a healthy empty population. The claim remains active so the root problem produced by the claim-side loader is reported, and the loader's own record of the failed base is what activation reads to tell the two apart. Handing this an empty map would test a state the loader cannot hand it. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Resolve a Markdown claim against a missing root. Record the population failure the claim-side loader records. Assert the unreadable claim remains active for diagnosis. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestUnreadableMarkdownClaimRootDoesNotBecomeInactive is the selectable Go test entry; its local loops and closures remain owned by this entry. It exercises activeGraphConfig with a recorded Markdown population failure within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestUnreadableMarkdownClaimRootDoesNotBecomeInactive(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"markdown",
    "root":"missing-docs",
    "files":["**/*.md"],
    "symbol":"h2",
    "reference":{"type":"prisma","files":["prisma/**/*.prisma"],"symbol":"model"}
  }]}`)
  markdown := map[string]*artifactInventory{}
  recordPopulationFailure(markdown, artifactMarkdown, config.Claims[0].Base)
  active := activeGraphConfig(
    config,
    markdown,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
  )
  if len(active.Claims) != 1 {
    t.Fatal("an unreadable Markdown root must remain active for its loader diagnostic")
  }
}
