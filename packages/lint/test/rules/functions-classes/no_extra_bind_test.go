package linthost

import "testing"

// TestRuleCorpusNoExtraBind verifies the lint rule corpus fixture no-extra-bind.ts.
//
// Rule corpus tests mirror tests/test-lint/src/cases inside Go unit coverage. Each generated
// scenario keeps one annotated TypeScript fixture tied to the native Engine so individual rule
// Check methods are measured by go test instead of only by the TypeScript feature runner.
//
// The fixture pins regular and arrow targets, computed and optional member
// forms, partial application, spread arguments, and lexical `this` ownership.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severities declared by its // expect: comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoExtraBind(t *testing.T) {
  assertRuleCorpusCase(t, "no-extra-bind.ts", `declare const receiver: { value: number };
const bindArguments = [receiver] as const;

// expect: no-extra-bind error
const arrow = (() => 1).bind(receiver);

// expect: no-extra-bind error
const regular = (function () {
  return 2;
}).bind(receiver);

// expect: no-extra-bind error
const computed = (function () {
  return 3;
})["bind"](receiver);

// expect: no-extra-bind error
const template = (function () {
  return 4;
})[`+"`bind`"+`](receiver);

// expect: no-extra-bind error
const optionalMember = (function () {
  return 5;
})?.["bind"](receiver);

// expect: no-extra-bind error
const optionalCall = (function () {
  return 6;
}).bind?.(receiver);

// expect: no-extra-bind error
const parenthesizedMember = ((function () {
  return 7;
}).bind)(receiver);

// expect: no-extra-bind error
const nestedRegular = (function () {
  return function (this: { value: number }) {
    return this.value;
  };
}).bind(receiver);

const partial = (function (value: number) {
  return value;
}).bind(null, 1);

const arrowPartial = ((value: number) => value).bind(null, 1);
const spread = (function () {
  return 8;
}).bind(...bindArguments);

const ownThis = (function (this: { value: number }) {
  return this.value;
}).bind(receiver);

const inheritedArrowThis = (function (this: { value: number }) {
  return () => this.value;
}).bind(receiver);

const parameterDefaultThis = (function (
  this: { value: number },
  value = this.value,
) {
  return value;
}).bind(receiver);

JSON.stringify({
  arrow,
  regular,
  computed,
  template,
  optionalMember,
  optionalCall,
  parenthesizedMember,
  nestedRegular,
  partial,
  arrowPartial,
  spread,
  ownThis,
  inheritedArrowThis,
  parameterDefaultThis,
});
`)
}
