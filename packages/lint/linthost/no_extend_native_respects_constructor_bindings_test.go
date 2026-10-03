package linthost

import "testing"

// TestNoExtendNativeRespectsConstructorBindings distinguishes the native
// constructor from a parameter, local declaration or module binding.
//
// Native prototype writes affect shared globals. A local constructor named
// Array owns a different prototype and is outside the prohibition.
//
// 1. Run the actual rule on authored lexical shadows and native controls.
// 2. Require shadows to remain silent and native writes to report once.
// 3. Preserve type-only augmentation and explicit exceptions as controls.
//
// @evidence contracts/testing.md#behavioral-verification Named cases execute no-extend-native on lexical constructor shadows and native constructor writes and assert literal finding counts.
// @evidence contracts/testing.md#independent-expectations ECMAScript lexical declarations bind the local Array rather than the global native constructor; an interface alone introduces no replacement runtime value. ESLint's no-extend-native resolves references from the global scope.
// @evidence contracts/testing.md#distinguishing-cases Parameter, destructured parameter, function-local var, block class, catch binding, module-local declaration and hoisted local function are silent; native assignment, native defineProperty, type-only augmentation and exceptions distinguish over-suppression.
// @evidence contracts/testing.md#execution-ownership This Go Test and named subtests use runRuleFindingsSnapshot to execute the owning engine; its declared checker requirement selects the direct Program lifecycle without installing a consumer or launching a product host.
func TestNoExtendNativeRespectsConstructorBindings(t *testing.T) {
  cases := []struct {
    name string
    source string
    count int
  }{
    {"parameter", "function f(Array: any) { Array.prototype.extra = 1; }\n", 0},
    {"destructured parameter", "function f({Array}: any) { Array.prototype.extra = 1; }\n", 0},
    {"function-local var", "function f() { var Array = function() {}; Array.prototype.extra = 1; }\n", 0},
    {"block class", "{ class Array {} Array.prototype.extra = 1; }\n", 0},
    {"catch binding", "try {} catch (Array) { Array.prototype.extra = 1; }\n", 0},
    {"module binding", "export {}; const Array = function() {}; Array.prototype.extra = 1;\n", 0},
    {"hoisted function", "function f() { Array.prototype.extra = 1; function Array() {} }\n", 0},
    {"shadowed defineProperty target", "function f(Array: any) { Object.defineProperty(Array.prototype, 'extra', {value: 1}); }\n", 0},
    {"native assignment", "Array.prototype.extra = 1;\n", 1},
    {"native defineProperty", "Object.defineProperty(Array.prototype, 'extra', {value: 1});\n", 1},
    {"type-only augmentation", "interface Array<T> { marker: T; } Array.prototype.extra = 1;\n", 1},
  }
  for _, row := range cases {
    t.Run(row.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "no-extend-native", row.source, nil)
      if len(findings) != row.count {
        t.Errorf("want %d native prototype writes, got %d: %+v", row.count, len(findings), findings)
      }
    })
  }
  t.Run("explicit exception", func(t *testing.T) {
    assertRuleSkipsSourceWithOptions(t, "no-extend-native", "Array.prototype.extra = 1;\n", `{"exceptions":["Array"]}`)
  })
}
