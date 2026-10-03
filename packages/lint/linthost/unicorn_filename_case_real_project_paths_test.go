package linthost

import (
  "testing"
)

// TestUnicornFilenameCaseRealProjectPaths verifies the rule against a real
// on-disk project layout with the host operating system's separators.
//
// Virtual `/project` paths cannot prove Windows drive-letter and backslash
// handling; this scenario materializes a temp project the same way command
// tests do, so `filepath.Rel` sees genuine OS-specific spellings on
// the single unit-runner host, without an OS test matrix.
//
// 1. Materialize `Foo_Bar.ts` under a temp root and lint it.
// 2. Materialize a clean `foo-bar.ts` twin.
// 3. Assert the diagnostic (and its absence) with project-relative segments.
//
// @evidence contracts/testing.md#behavioral-verification The rule executes on a real temporary source pathname and checks the exact Foo_Bar.ts diagnostic without a consumer installation.
// @evidence contracts/testing.md#independent-expectations The authored filename violates the supported default case rule, and the expected message is literal rather than inferred from native path output.
// @evidence contracts/testing.md#distinguishing-cases This host owns a native temporary path for Foo_Bar.ts; virtual path and outside-project scope distinctions belong to the other filename hosts.
// @evidence contracts/testing.md#execution-ownership TestUnicornFilenameCaseRealProjectPaths owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestUnicornFilenameCaseRealProjectPaths(t *testing.T) {
  _, _, findings := runRuleFindingsSnapshotFile(
    t,
    unicornFilenameCaseRuleName,
    "Foo_Bar.ts",
    "export const value = 1;\n",
    nil,
  )
  assertUnicornRuleErrorFindingIdentities(t, unicornFilenameCaseRuleName, findings)
  if len(findings) != 1 {
    t.Fatalf("want one finding, got %d (%+v)", len(findings), findings)
  }
  want := "Filename is not in kebab case. Rename it to `foo-bar.ts`."
  if findings[0].Message != want {
    t.Fatalf("want %q, got %q", want, findings[0].Message)
  }

  _, _, clean := runRuleFindingsSnapshotFile(
    t,
    unicornFilenameCaseRuleName,
    "foo-bar.ts",
    "export const value = 1;\n",
    nil,
  )
  if len(clean) != 0 {
    t.Fatalf("clean twin: want no findings, got %d (%+v)", len(clean), clean)
  }
}
