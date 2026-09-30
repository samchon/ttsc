import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/src/npm/collectExternalPackageNames";

/**
 * A slash after a control header or statement block starts a regex literal,
 * while a slash after an object, function, or class expression is division.
 * Both rules apply again inside executable template substitutions.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls collectExternalPackageNames with control headers, declaration blocks and expression values; the exact ten names must include executable division operands and exclude every regex-body lookalike.
 * @evidence contracts/testing.md#independent-expectations Authored statement and expression positions determine JavaScript regex versus division interpretation. Literal sorted names enumerate real require arguments without deriving expectations from lexer tokens.
 * @evidence contracts/testing.md#distinguishing-cases Control headers, catch blocks, function/class declarations and class heritage contrast with object/function/async-function/class expressions. Member keywords and destructured class keys cannot change lexical context; the same distinction runs inside a template substitution.
 * @evidence contracts/testing.md#execution-ownership This named source unit directly calls the authored collector in the shared playground unit process with one in-memory string. It performs no download, installation, native build or product host invocation; template and non-code cases own complementary lexical boundaries.
 */
export const test_collect_external_package_names_classifies_regex_statement_and_value_boundaries =
  () => {
    const source = [
      'if (ok) /require\\("if-ghost"\\)/.test(value);',
      'while (ok) /require\\("while-ghost"\\)/.test(value);',
      'for (; ok;) /require\\("for-ghost"\\)/.test(value);',
      'with (scope) /require\\("with-ghost"\\)/.test(value);',
      'switch (value) {} /require\\("switch-ghost"\\)/.test(value);',
      'try {} catch (error) {} /require\\("catch-ghost"\\)/.test(value);',
      'if (ok) {} /require\\("block-ghost"\\)/.test(value);',
      'const before = 0; function declaredFunction() {} /require\\("function-declaration-ghost"\\)/.test(value);',
      'class DeclaredClass {} /require\\("class-declaration-ghost"\\)/.test(value);',
      'class Child extends mixin({}) {} /require\\("class-heritage-ghost"\\)/.test(value);',
      '{ function blockFunction() {} /require\\("block-function-ghost"\\)/.test(value); }',
      'const objectValue = {} / require("object-real") / 2;',
      'const functionValue = function () {} / require("function-real") / 2;',
      'const asyncFunctionValue = async function () {} / require("async-function-real") / 2;',
      'const classValue = class {} / require("class-real") / 2;',
      'const memberValue = object.if() / require("member-real") / 2;',
      'const memberClassValue = object.class; const classObjectValue = {} / require("member-class-real") / 2;',
      'const { class: propertyClass } = object; const propertyClassObject = {} / require("property-class-real") / 2;',
      'const template = `${(() => { if (ok) /require\\("template-ghost"\\)/.test(value); const objectValue = {} / require("template-object-real") / 2; return require("template-real"); })()}`;',
      'require("outside-real");',
    ].join("\n");

    assert.deepEqual(collectExternalPackageNames(source, []), [
      "async-function-real",
      "class-real",
      "function-real",
      "member-class-real",
      "member-real",
      "object-real",
      "outside-real",
      "property-class-real",
      "template-object-real",
      "template-real",
    ]);
  };
