package linthost

import (
  "os"
  "testing"
)

// TestNoExtraBooleanCastPreservesShadowedConverters verifies that removing a
// Boolean call requires the actual built-in conversion rather than its name.
//
// A parameter or local function named Boolean may return false for a truthy
// argument. Replacing its call by that argument changes which branch executes;
// the conversion is therefore neither redundant nor eligible for a fix.
//
// 1. Run the owning Engine on parameter, block, module and hoisted shadows.
// 2. Require each shadowed call to produce no redundant-conversion finding.
// 3. Apply real fixes to an unshadowed Boolean call and double negation.
//
// @evidence contracts/testing.md#behavioral-verification runRuleFindingsSnapshot executes no-extra-boolean-cast, compares zero findings and applies actual fixes to require unchanged source for lexical and script-global converter bindings; assertFixSnapshot applies the real edits to built-in, type-only augmentation and double-negation controls and compares complete output text.
// @evidence contracts/testing.md#independent-expectations A supplied converter can return false for 1, while the built-in Boolean and double negation yield its truthiness. Removing the custom call would change the branch, independently of the rule's matching algorithm.
// @evidence contracts/testing.md#distinguishing-cases Parameter, block-local constant, module-local constant, hoisted function and script-global bindings distinguish lexical ownership and merged global runtime declarations from an identifier's spelling. Unshadowed Boolean, type-only interface augmentation and double negation must still simplify, preventing blanket suppression.
// @evidence contracts/testing.md#execution-ownership The discoverable Go Test and its named subtests call the owning Engine through runRuleFindingsSnapshot and assertFixSnapshot in one unit process. The helper loads the real Program/checker required to resolve converter bindings; no consumer installation, native build or real product host is used.
func TestNoExtraBooleanCastPreservesShadowedConverters(t *testing.T) {
  shadows := []struct {
    name string
    source string
  }{
    {"parameter", "function f(Boolean: (x: number) => boolean) { if (Boolean(1)) return 1; return 0; }\n"},
    {"block-local", "function f() { const Boolean = (x: number) => false; if (Boolean(1)) return 1; return 0; }\n"},
    {"module-local", "export {}; const Boolean = (x: number) => false; if (Boolean(1)) console.log(1);\n"},
    {"hoisted-function", "function f() { if (Boolean(1)) return 1; return 0; function Boolean(x: number) { return false; } }\n"},
    {"script-global", "function Boolean(x: number) { return false; } if (Boolean(1)) console.log(1);\n"},
  }
  for _, row := range shadows {
    t.Run(row.name, func(t *testing.T) {
      root, file, findings := runRuleFindingsSnapshot(t, "no-extra-boolean-cast", row.source, nil)
      if len(findings) != 0 {
        t.Errorf("custom Boolean converter must remain callable: got %d findings", len(findings))
      }
      fixed, err := applyFindingFixes(root, findings)
      if err != nil {
        t.Fatal(err)
      }
      actual, err := os.ReadFile(file)
      if err != nil {
        t.Fatal(err)
      }
      if fixed != 0 || string(actual) != row.source {
        t.Errorf("custom conversion must preserve branch meaning: applied=%d source=%q", fixed, actual)
      }
    })
  }
  t.Run("built-in", func(t *testing.T) {
    assertFixSnapshot(t, "no-extra-boolean-cast", "if (Boolean(1)) console.log(1);\n", "if (1) console.log(1);\n")
  })
  t.Run("double-negation", func(t *testing.T) {
    assertFixSnapshot(t, "no-extra-boolean-cast", "if (!!1) console.log(1);\n", "if (1) console.log(1);\n")
  })
  t.Run("type-only-global-augmentation", func(t *testing.T) {
    assertFixSnapshot(t, "no-extra-boolean-cast", "interface Boolean { marker: string; } if (Boolean(1)) console.log(1);\n", "interface Boolean { marker: string; } if (1) console.log(1);\n")
  })
}
