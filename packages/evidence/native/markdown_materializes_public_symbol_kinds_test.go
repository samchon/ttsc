package evidence

import (
  "sort"
  "strings"
  "testing"
)

/**
 * Verifies Markdown materialization: file and H1-H4 units receive the target
 * identities documented by TtscEvidenceGraphMarkdownSymbol.
 *
 * Heading level and anchor are separate pieces of the contract. This fixture
 * includes explicit, generated, duplicate-capable, and unsupported levels so a
 * broad line matcher cannot accidentally turn every heading into evidence.
 *
 *  1. Scan one document containing H1 through H5.
 *  2. Collect every materialized target and declaration host.
 *  3. Assert file/H1-H4 unit identities, exclude an H5 unit, and retain its declaration host kind.
 *
 * @evidence contracts/testing.md#behavioral-verification scanProjectMarkdown exercises this case. Verifies Markdown materialization: file and H1-H4 units receive the target identities documented by TtscEvidenceGraphMarkdownSymbol.
 *
 * @evidence contracts/testing.md#independent-expectations The literal target list contains file/H1-H4 identities and no H5 unit, while declarations retain file,h1,h2,h3,h4,h5 host kinds. Targets and hosts answer distinct contract questions.
 *
 * @evidence contracts/testing.md#distinguishing-cases Scan one document containing H1 through H5. Collect every materialized target and declaration host. Assert file/H1-H4 unit identities, exclude an H5 unit, and retain its declaration host kind.
 *
 * @evidence contracts/testing.md#execution-ownership TestMarkdownMaterializesFileAndHeadingKinds is the selectable Go entry and owns its fixture variants and local closures. It invokes scanProjectMarkdown in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
 */
func TestMarkdownMaterializesFileAndHeadingKinds(t *testing.T) {
  inventory, problems := scanProjectMarkdown("docs/spec.md", `<!-- @evidence docs/source.md File host. -->
# Product Overview
<!-- @evidence docs/source.md#one H1 host. -->
## Create Order {#create}
<!-- @evidence docs/source.md#two H2 host. -->
### Retry Policy
<!-- @evidence docs/source.md#three H3 host. -->
#### Audit Trail
<!-- @evidence docs/source.md#four H4 host. -->
##### Internal Notes
<!-- @evidence docs/source.md#five H5 host. -->
`)
  if len(problems) != 0 {
    t.Fatalf("unexpected Markdown scan problems: %v", problems)
  }
  targets := []string{}
  for _, unit := range inventory.Units {
    targets = append(targets, unit.Target)
  }
  sort.Strings(targets)
  wantTargets := []string{
    "docs/spec.md",
    "docs/spec.md#audit-trail",
    "docs/spec.md#create",
    "docs/spec.md#product-overview",
    "docs/spec.md#retry-policy",
  }
  sort.Strings(wantTargets)
  if strings.Join(targets, "\n") != strings.Join(wantTargets, "\n") {
    t.Fatalf("Markdown targets:\n%s\nwant:\n%s", strings.Join(targets, "\n"), strings.Join(wantTargets, "\n"))
  }
  hosts := []string{}
  for _, declaration := range inventory.Declarations {
    hosts = append(hosts, declaration.Hosts.names())
  }
  if got := strings.Join(hosts, ","); got != "file,h1,h2,h3,h4,h5" {
    t.Fatalf("Markdown declaration hosts = %q", got)
  }
}
