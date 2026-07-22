import assert from "node:assert/strict";

import { collectExternalPackageNames } from "../../../../packages/playground/lib/src/npm/collectExternalPackageNames.js";

/**
 * A slash after a control header or statement block starts a regex literal,
 * while a slash after an object, function, or class expression is division.
 * Both rules apply again inside executable template substitutions.
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
