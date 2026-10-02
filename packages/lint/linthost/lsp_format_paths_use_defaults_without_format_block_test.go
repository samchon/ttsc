package linthost

import (
  "testing"
)

// TestLSPFormatPathsUseDefaultsWithoutFormatBlock guards the distinction
// between a lint configuration and an explicit formatter configuration.
//
// A rules-only lint.config.json must not suppress documented formatter
// defaults on any LSP path.
//
//  1. Seed a rules-only lint configuration and an unterminated source.
//  2. Require the format action and authored default terminator result on every path.
//
// @evidence contracts/testing.md#behavioral-verification A rules-only no-var-off configuration still offers the format action and returns default semicolon text through disk, buffer and format dispatch.
// @evidence contracts/testing.md#independent-expectations The authored const value = 1 semicolon output and sole format command are checked independently on each front door.
// @evidence contracts/testing.md#distinguishing-cases Present lint configuration with no format block distinguishes default activation from the absent-config companion and explicit format configuration.
// @evidence contracts/testing.md#execution-ownership JSON configuration loading, native formatting and command dispatch run directly in the one Go unit process without executable configuration or external formatter.
func TestLSPFormatPathsUseDefaultsWithoutFormatBlock(t *testing.T) {
  source := "const value = 1\n"
  root := seedLintProject(t, source)
  seedLintConfig(t, root, map[string]any{
    "rules": map[string]any{"no-var": "off"},
  })

  assertCanonicalLSPFormatPaths(t, root, source, "const value = 1;\n")
}
