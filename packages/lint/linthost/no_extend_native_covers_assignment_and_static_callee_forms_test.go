package linthost

import "testing"

// TestNoExtendNativeCoversAssignmentAndStaticCalleeForms verifies that a
// prototype write is protected independently of its assignment operator or
// the static spelling of Object.defineProperty and Object.defineProperties.
//
// 1. Execute all sixteen ECMAScript assignment operators against Array.prototype.
// 2. Execute computed, template and optional define-property callees.
// 3. Require unrelated methods, dynamic methods and prototype reads to stay silent.
//
// @evidence contracts/testing.md#behavioral-verification Every authored assignment operator and static define-property call reports one native prototype mutation; nonwrite and unsupported method controls report none.
// @evidence contracts/testing.md#independent-expectations The literal ECMAScript assignment operator list defines writes independently of the implementation. ESLint's no-extend-native accepts AssignmentExpression and statically named defineProperty/defineProperties calls.
// @evidence contracts/testing.md#distinguishing-cases Arithmetic, shift, bitwise, exponentiation and logical/nullish assignments distinguish the full write surface. Computed strings, template literals, optional access and parentheses distinguish static callees from dynamic or unrelated calls.
// @evidence contracts/testing.md#execution-ownership This selected Go Test owns its named subtests and authored counts; runRuleFindingsSnapshot invokes the actual lint engine directly in the Go unit process without consumer preparation or native product-host builds.
func TestNoExtendNativeCoversAssignmentAndStaticCalleeForms(t *testing.T) {
  for _, operator := range []string{"=", "+=", "-=", "*=", "/=", "%=", "**=", "<<=", ">>=", ">>>=", "&=", "|=", "^=", "&&=", "||=", "??="} {
    t.Run(operator, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "no-extend-native", "Array.prototype.extra " + operator + " 1;\n", nil)
      if len(findings) != 1 {
        t.Errorf("want one native prototype write, got %d: %+v", len(findings), findings)
      }
    })
  }
  cases := []struct {
    name string
    source string
    count int
  }{
    {"computed singular", "Object['defineProperty'](Array.prototype, 'extra', {value: 1});\n", 1},
    {"computed plural", "Object['defineProperties'](Array.prototype, {extra: {value: 1}});\n", 1},
    {"template method", "Object[`defineProperty`](Array.prototype, 'extra', {value: 1});\n", 1},
    {"parenthesized prototype key", "Array[('prototype')].extra = 1;\n", 1},
    {"template prototype key", "Array[`prototype`].extra = 1;\n", 1},
    {"optional method", "Object?.defineProperty(Array.prototype, 'extra', {value: 1});\n", 1},
    {"parenthesized method", "(Object.defineProperty)(Array.prototype, 'extra', {value: 1});\n", 1},
    {"optional prototype", "Object.defineProperty(Array?.prototype, 'extra', {value: 1});\n", 1},
    {"unrelated method", "Object.assign(Array.prototype, {extra: 1});\n", 0},
    {"dynamic method", "Object[method](Array.prototype, 'extra', {value: 1});\n", 0},
    {"prototype read", "const value = Array.prototype.extra;\n", 0},
    {"constructor property", "Array.extra += 1;\n", 0},
  }
  for _, row := range cases {
    t.Run(row.name, func(t *testing.T) {
      _, _, findings := runRuleFindingsSnapshot(t, "no-extend-native", row.source, nil)
      if len(findings) != row.count {
        t.Errorf("want %d native prototype writes, got %d: %+v", row.count, len(findings), findings)
      }
    })
  }
}
