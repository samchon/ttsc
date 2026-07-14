package linthost

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"
)

// TestDiagnosticCodesDistinguishFormerCollisionAcrossCLIAndLSP verifies two
// rules that historically shared TS13729 remain distinguishable end to end.
//
// The native compiler stream exposes numeric TS-style codes, while LSP exposes
// stable rule IDs in its code field. Both surfaces must keep the original rule
// IDs and messages as the numeric allocator changes beneath them.
//
//  1. Run check with no-alert and no-unreachable against one real project.
//  2. Assert native output contains distinct numeric codes and exact messages.
//  3. Run lsp-diagnostics and assert both rule IDs and messages are unchanged.
func TestDiagnosticCodesDistinguishFormerCollisionAcrossCLIAndLSP(t *testing.T) {
	root := seedLintProject(t, `declare function alert(message: string): void;
alert("boom");
function stopped(): void {
  return;
  console.log("dead");
}
stopped();
`)
	seedLintRules(t, root, map[string]string{
		"no-alert":       "error",
		"no-unreachable": "error",
	})
	alertCode := RuleCode("no-alert")
	unreachableCode := RuleCode("no-unreachable")
	if alertCode == unreachableCode {
		t.Fatalf("former collision remains at TS%d", alertCode)
	}

	code, stdout, stderr := captureCommandOutput(t, func() int {
		return run([]string{
			"check",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
		})
	})
	if code != 2 || stdout != "" {
		t.Fatalf("check result mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	wantAlert := fmt.Sprintf("TS%d: [no-alert] Unexpected alert.", alertCode)
	wantUnreachable := fmt.Sprintf("TS%d: [no-unreachable] Unreachable code.", unreachableCode)
	if !diagnosticOutputContains(stderr, wantAlert) || !diagnosticOutputContains(stderr, wantUnreachable) {
		t.Fatalf("native diagnostics missing distinct rule codes:\nwant %q\nwant %q\nstderr=%q", wantAlert, wantUnreachable, stderr)
	}

	uri := lintTestFileURI(t, filepath.Join(root, "src", "main.ts"))
	code, stdout, stderr = captureCommandOutput(t, func() int {
		return run([]string{
			"lsp-diagnostics",
			"--cwd", root,
			"--plugins-json", lintManifest(t),
			"--uri", uri,
		})
	})
	if code != 0 || stderr != "" {
		t.Fatalf("lsp-diagnostics mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
	}
	var result lspDiagnosticsResult
	if err := json.Unmarshal([]byte(stdout), &result); err != nil {
		t.Fatalf("lsp-diagnostics JSON: %v\n%s", err, stdout)
	}
	wantMessages := map[string]string{
		"no-alert":       "Unexpected alert.",
		"no-unreachable": "Unreachable code.",
	}
	seen := make(map[string]bool, len(wantMessages))
	for _, diagnostic := range result.Document {
		wantMessage, relevant := wantMessages[diagnostic.Code]
		if !relevant {
			continue
		}
		if diagnostic.Source != "@ttsc/lint" || diagnostic.Message != wantMessage {
			t.Fatalf("LSP diagnostic changed for %q: %#v", diagnostic.Code, diagnostic)
		}
		seen[diagnostic.Code] = true
	}
	for rule := range wantMessages {
		if !seen[rule] {
			t.Fatalf("LSP diagnostics missing rule %q: %#v", rule, result.Document)
		}
	}
}
