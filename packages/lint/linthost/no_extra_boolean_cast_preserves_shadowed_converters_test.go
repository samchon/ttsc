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
//  1. Run the owning Engine on parameter, block, module and hoisted shadows,
//     including double negation passed to custom calls and constructors.
//  2. Require each shadowed call to produce no redundant-conversion finding.
//  3. Apply real fixes to an unshadowed Boolean call and double negation.
//
// @evidence contracts/testing.md#behavioral-verification runRuleFindingsSnapshot executes no-extra-boolean-cast, compares zero findings and applies actual fixes to require unchanged source for lexical and script-global converter bindings; assertFixSnapshot applies the real edits to built-in, type-only augmentation and double-negation controls and compares complete output text.
// @evidence contracts/testing.md#independent-expectations A supplied converter can return false for 1, while built-in Boolean yields truthiness. A custom call or constructor can also retain the difference between true and 1, so removing its argument's double negation changes independently observable data. Whole source literals must remain unchanged for these bindings.
// @evidence contracts/testing.md#distinguishing-cases Parameter, block-local constant, module-local constant, hoisted function and script-global bindings distinguish lexical ownership and merged global runtime declarations from an identifier's spelling. Double negation inside custom call/new arguments remains; built-in call/new arguments, type-only augmentation and ordinary boolean-context double negation still simplify, preventing blanket suppression.
// @evidence contracts/testing.md#execution-ownership The discoverable Go Test and its named subtests call the owning Engine through runRuleFindingsSnapshot and assertFixSnapshot in one unit process. The helper loads the real Program/checker required to resolve converter bindings; no consumer installation, native build or real product host is used.
func TestNoExtraBooleanCastPreservesShadowedConverters(t *testing.T) {
  shadows := []struct {
    name   string
    source string
  }{
    {"parameter", "function f(Boolean: (x: number) => boolean) { if (Boolean(1)) return 1; return 0; }\n"},
    {"block-local", "function f() { const Boolean = (x: number) => false; if (Boolean(1)) return 1; return 0; }\n"},
    {"module-local", "export {}; const Boolean = (x: number) => false; if (Boolean(1)) console.log(1);\n"},
    {"hoisted-function", "function f() { if (Boolean(1)) return 1; return 0; function Boolean(x: number) { return false; } }\n"},
    {"script-global", "function Boolean(x: number) { return false; } if (Boolean(1)) console.log(1);\n"},
    {"argument-parameter", "function f(Boolean: (x: unknown) => unknown) { return Boolean(!!1); }\n"},
    {"argument-block-local", "function f() { const Boolean = (x: unknown) => x; return Boolean(!!1); }\n"},
    {"argument-module-local", "export {}; const Boolean = (x: unknown) => x; Boolean(!!1);\n"},
    {"argument-hoisted", "function f() { return Boolean(!!1); function Boolean(x: unknown) { return x; } }\n"},
    {"argument-script-global", "function Boolean(x: unknown) { return x; } Boolean(!!1);\n"},
    {"constructor-parameter", "function f(Boolean: new (x: unknown) => object) { return new Boolean(!!1); }\n"},
    {"constructor-module-local", "export {}; class Boolean { constructor(public value: unknown) {} } new Boolean(!!1);\n"},
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
  t.Run("built-in-call-argument", func(t *testing.T) {
    assertFixSnapshot(t, "no-extra-boolean-cast", "const v = Boolean(!!1);\n", "const v = Boolean(1);\n")
  })
  t.Run("built-in-constructor-argument", func(t *testing.T) {
    assertFixSnapshot(t, "no-extra-boolean-cast", "const v = new Boolean(!!1);\n", "const v = new Boolean(1);\n")
  })
  t.Run("type-only-global-augmentation", func(t *testing.T) {
    assertFixSnapshot(t, "no-extra-boolean-cast", "interface Boolean { marker: string; } if (Boolean(1)) console.log(1);\n", "interface Boolean { marker: string; } if (1) console.log(1);\n")
  })
}
