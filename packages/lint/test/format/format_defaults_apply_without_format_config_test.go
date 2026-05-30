package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestFormatDefaultsApplyWithoutFormatConfig verifies the format paths apply the
// documented default rules when the project configures no `format` block.
//
// formatOnSave must work out of the box: with an empty resolver (no format
// rules configured) newFormatCommandResolver loads the always-on defaults, so
// the engine still produces format findings. This pins requirement #1/#2 — the
// formatter no longer no-ops when a `format` block is absent.
//
// 1. Build a format resolver over an empty config from a temp dir.
// 2. Run the engine on a source missing its statement terminator.
// 3. Assert the default format/semi rule fires.
func TestFormatDefaultsApplyWithoutFormatConfig(t *testing.T) {
  resolver, err := newFormatCommandResolver(RuleConfig{}, t.TempDir(), "")
  if err != nil {
    t.Fatalf("newFormatCommandResolver: %v", err)
  }
  file := parseTS(t, "const x = 1\n")
  findings := filterFormatFindings(
    NewEngineWithResolver(resolver).Run([]*shimast.SourceFile{file}, nil),
  )
  if len(findings) == 0 {
    t.Fatalf("expected default format rules to fire without a format block")
  }
  found := false
  for _, finding := range findings {
    if finding.Rule == "format/semi" {
      found = true
    }
  }
  if !found {
    t.Fatalf("expected default format/semi to fire; got %d findings", len(findings))
  }
}
