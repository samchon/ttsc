package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestNoVarSkipsAmbientDeclareVar verifies explicitly declared and inherited
// ambient variables in regular TypeScript sources do not trip no-var.
//
// Ambient declarations describe existing bindings instead of creating runtime
// variables. The native allowance includes declare-global property typing and
// nested ambient namespace/module members; an ordinary runtime namespace or
// module still reports. This unit runs parser/Engine behavior, not checker
// validation or the side-effect module's runtime execution.
//
// @evidence contracts/testing.md#behavioral-verification Engine emits zero no-var findings for direct declare-var and inherited ambient global/namespace/module members; ordinary runtime declarations report one no-var finding each.
// @evidence contracts/testing.md#independent-expectations Authored zero expectations follow erased ambient declaration semantics. The declare-global input retains the globalThis typed carrier and assignment; this parser/Engine unit does not certify checker admission or actual side-effect execution.
// @evidence contracts/testing.md#distinguishing-cases The original direct declare-var input is retained. Declare-global, nested declare-namespace and external-module members distinguish inherited ambientness from an explicit statement modifier; ordinary global, namespace and module var inputs remain positive runtime controls. The declaration-file unit separately owns file classification.
// @evidence contracts/testing.md#execution-ownership Each named input is parsed in memory and run through NewEngine(no-var).Run in this existing discoverable Go unit entry, without consumer installation, native artifact building or a product host.
func TestNoVarSkipsAmbientDeclareVar(t *testing.T) {
  file := parseTS(t, "declare var ambient: string;\nJSON.stringify(typeof ambient);\n")
  findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Fatalf("noVar reported ambient declare var: %d findings", len(findings))
  }
  cases := []struct {
    name   string
    source string
    count  int
  }{
    {"global augmentation", "export {};\ndeclare global { var __ttsxSideEffect: string | undefined; }\nglobalThis.__ttsxSideEffect = \"side-effect-import-ok\";\n", 0},
    {"ambient namespace", "declare namespace Ambient { var value: string; }\n", 0},
    {"nested ambient namespace", "declare namespace Ambient { namespace Nested { var value: string; } }\n", 0},
    {"ambient external module", "declare module \"ambient-module\" { var value: string; }\n", 0},
    {"ordinary script", "var value = 1;\n", 1},
    {"ordinary namespace", "namespace Runtime { export var value = 1; }\n", 1},
    {"ordinary module", "export {};\nvar value = 1;\n", 1},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      file := parseTS(t, tc.source)
      findings := NewEngine(RuleConfig{"no-var": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
      if len(findings) != tc.count {
        t.Fatalf("no-var finding count: got %d, want %d: %+v", len(findings), tc.count, findings)
      }
      for _, finding := range findings {
        if finding.Rule != "no-var" {
          t.Fatalf("unexpected finding: %+v", finding)
        }
      }
    })
  }
}
