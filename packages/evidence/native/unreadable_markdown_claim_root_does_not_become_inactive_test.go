package evidence

import (
  "testing"
)

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
 *
 * @evidence contracts/testing.md#behavioral-verification activeGraphConfig is called on a decoded Markdown claim whose root is missing and whose Markdown inventory holds only the failure record that recordPopulationFailure writes for that base; the test requires the claim to stay in the returned configuration. The loader itself is not run; the failure record is injected by calling recordPopulationFailure directly.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the contract that an unhealthy population cannot prove emptiness, so a claim with zero matched files but a recorded load failure stays active (one claim kept). The recorded failure is the only input that differs from a healthy empty population.
 * @evidence contracts/testing.md#distinguishing-cases Only the failed-base case runs; the contrasting healthy-empty population that must become inactive is not exercised here, so a function that never dropped any claim would also pass.
 * @evidence contracts/testing.md#execution-ownership TestUnreadableMarkdownClaimRootDoesNotBecomeInactive is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
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
