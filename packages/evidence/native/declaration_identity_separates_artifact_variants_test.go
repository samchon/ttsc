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
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown scans one `<!-- @evidence ... -->` declaration and parseTypeScriptInventory scans one `/** @evidence ... *\/` declaration, both registered at the same path `src/mixed.ts` and the same line; each inventory must hold exactly one declaration and the two declaration IDs must differ.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the identity contract that the artifact kind is part of a declaration's identity: the path and line are made identical on purpose, so equal IDs would show the discriminator is missing.
 * @evidence contracts/testing.md#distinguishing-cases One Markdown and one TypeScript declaration at the same location are the only pair compared; the same-artifact duplicate and different-line cases are owned by other entries, and the ID's exact format is not asserted.
 * @evidence contracts/testing.md#execution-ownership TestDeclarationIdentitySeparatesArtifactVariants is a Go unit entry in the native test process; it scans in-memory Markdown and parses in-memory TypeScript with no filesystem, consumer install or product host.
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
