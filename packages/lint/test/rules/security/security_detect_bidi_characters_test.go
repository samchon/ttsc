package linthost

import (
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestSecurityDetectBidiCharacters verifies security rule: detect-bidi-characters reports Trojan Source controls.
//
// Locks the source-file scanning path because bidi controls can hide inside
// literals or comments before the AST exposes ordinary JavaScript tokens.
//
// 1. Parse a file containing one right-to-left override character.
// 2. Enable only `security/detect-bidi-characters`.
// 3. Assert one security finding is reported.
func TestSecurityDetectBidiCharacters(t *testing.T) {
	file := parseTS(t, "const access = \"user\u202e\";\n")
	findings := NewEngine(RuleConfig{
		"security/detect-bidi-characters": SeverityError,
	}).Run([]*shimast.SourceFile{file}, nil)
	if len(findings) != 1 || findings[0].Rule != "security/detect-bidi-characters" {
		t.Fatalf("want one bidi finding, got %+v", findingRules(findings))
	}
}
