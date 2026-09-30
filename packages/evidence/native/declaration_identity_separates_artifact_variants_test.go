package evidence

import "testing"

/**
 * Verifies declaration identity includes the artifact discriminator.
 *
 * One project path may deliberately be interpreted by separate configured
 * artifact variants. A path, line, and sequence alone would let a Markdown
 * declaration overwrite a TypeScript declaration when graph evaluation
 * deduplicates declarations globally.
 *
 *  1. Scan a Markdown and TypeScript declaration at the same path and line.
 *  2. Compare their internal declaration identities.
 *  3. Assert the artifact-specific identities remain distinct.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises this case: Verifies declaration identity includes the artifact discriminator. The original assertions check assert the artifact-specific identities remain distinct.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations One project path may deliberately be interpreted by separate configured artifact variants. A path, line, and sequence alone would let a Markdown declaration overwrite a TypeScript declaration when graph evaluation deduplicates declarations globally. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Scan a Markdown and TypeScript declaration at the same path and line. Compare their internal declaration identities. Assert the artifact-specific identities remain distinct. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDeclarationIdentitySeparatesArtifactVariants is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseTypeScriptInventory within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestDeclarationIdentitySeparatesArtifactVariants(t *testing.T) {
  markdown, problems := scanProjectMarkdown(
    "src/mixed.ts",
    "<!-- @evidence Shared Markdown reason. -->\n",
  )
  if len(problems) != 0 {
    t.Fatalf("unexpected Markdown scan problems: %v", problems)
  }
  typescript := parseTypeScriptInventory(
    t,
    "src/mixed.ts",
    "/** @evidence Shared TypeScript reason. */\nexport interface Ref {}\n",
  )
  if len(markdown.Declarations) != 1 || len(typescript.Declarations) != 1 {
    t.Fatalf(
      "declaration counts = Markdown %d, TypeScript %d",
      len(markdown.Declarations),
      len(typescript.Declarations),
    )
  }
  if markdown.Declarations[0].ID == typescript.Declarations[0].ID {
    t.Fatalf("artifact declarations shared identity %q", markdown.Declarations[0].ID)
  }
}
