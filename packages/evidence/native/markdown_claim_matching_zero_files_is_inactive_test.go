package evidence

import "testing"

/**
 * Verifies a healthy Markdown claim matching zero files is inactive.
 *
 * Markdown uses the same own-population gate as TypeScript and Prisma. The
 * missing Prisma root is deliberately placed behind the claim so silence also
 * proves reference loading did not start.
 *
 *  1. Match no Markdown file with the claim glob.
 *  2. Configure an unreadable Prisma reference root.
 *  3. Assert the healthy empty claim and its reference remain silent.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies a healthy Markdown claim matching zero files is inactive. The original assertions check assert the healthy empty claim and its reference remain silent.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Markdown uses the same own-population gate as TypeScript and Prisma. The missing Prisma root is deliberately placed behind the claim so silence also proves reference loading did not start. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match no Markdown file with the claim glob. Configure an unreadable Prisma reference root. Assert the healthy empty claim and its reference remain silent. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMarkdownClaimMatchingZeroFilesIsInactive is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestMarkdownClaimMatchingZeroFilesIsInactive(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/index.ts": "export interface Index {}\n",
  }, `{"claims":[{
    "type":"markdown",
    "files":["docs/absent/**/*.md"],
    "symbol":"h2",
    "reference":{
      "type":"prisma",
      "root":"missing-prisma",
      "files":["**/*.prisma"],
      "symbol":"model"
    }
  }]}`))
}
