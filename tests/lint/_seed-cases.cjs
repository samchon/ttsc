// One-shot generator that materializes a per-rule fixture under
// packages/lint/tests/cases/<rule>/violation.ts. Each fixture carries
// a `// expect: <rule> <severity>` annotation on the offending line so
// the e2e driver (cases.test.cjs) can pin the diagnostic.
//
// Run once:    node packages/lint/tests/_seed-cases.cjs
// Idempotent — already-existing fixtures are left alone.

const fs = require("node:fs");
const path = require("node:path");

const casesDir = path.resolve(__dirname, "cases");

// rule -> { violation: string, clean?: string, severity?: "error"|"warn" }
//
// `violation` is the source text. Place the `// expect:` comment one
// line before the offending statement; the driver pins the diagnostic
// to the next non-comment, non-blank line. Defaults to severity
// "error" unless overridden.
const fixtures = {
  // -------- ESLint Possible Problems --------
  "for-direction": { violation: `// expect: for-direction error\nfor (let i = 0; i < 10; i--) {}\n` },
  "no-async-promise-executor": {
    violation: `// expect: no-async-promise-executor error\nnew Promise(async (resolve) => { resolve(1); });\n`,
  },
  "no-class-assign": {
    violation: `class A {}\n// expect: no-class-assign error\nA = function () {} as any;\n`,
  },
  "no-compare-neg-zero": {
    violation: `function f(x: number) {\n  // expect: no-compare-neg-zero error\n  return x === -0;\n}\n`,
  },
  "no-cond-assign": {
    violation: `let a = 0; let b = 1;\n// expect: no-cond-assign error\nif (a = b) { console.log(a); }\n`,
  },
  "no-constant-condition": {
    violation: `// expect: no-constant-condition error\nif (1) { console.log("always"); }\n`,
  },
  "no-control-regex": {
    violation: `// expect: no-control-regex error\nconst r = /\\x1f/;\nvoid r;\n`,
  },
  "no-debugger": {
    violation: `function f(): void {\n  // expect: no-debugger error\n  debugger;\n}\nf();\n`,
  },
  "no-dupe-args": {
    violation: `// expect: no-dupe-args error\nfunction f(a: number, b: number, a: number) { return a + b; }\nf(1, 2, 3);\n`,
  },
  "no-dupe-else-if": {
    violation: `function f(a: any, b: any) {\n  if (a) { return 1; }\n  else if (b) { return 2; }\n  // expect: no-dupe-else-if error\n  else if (a) { return 3; }\n  return 0;\n}\nvoid f;\n`,
  },
  "no-dupe-keys": {
    violation: `const o = {\n  a: 1,\n  // expect: no-dupe-keys error\n  a: 2,\n};\nvoid o;\n`,
  },
  "no-duplicate-case": {
    violation: `function f(x: number) {\n  switch (x) {\n    case 1: return "a";\n    // expect: no-duplicate-case error\n    case 1: return "b";\n  }\n  return "";\n}\nvoid f;\n`,
  },
  "no-empty-character-class": {
    violation: `// expect: no-empty-character-class error\nconst r = /[]/;\nvoid r;\n`,
  },
  "no-empty-pattern": {
    violation: `// expect: no-empty-pattern error\nfunction f({}: { a?: number }): void {}\nf({ a: 1 });\n`,
  },
  "no-ex-assign": {
    violation: `try {\n  throw new Error("x");\n} catch (e) {\n  // expect: no-ex-assign error\n  e = "boom";\n  console.log(e);\n}\n`,
  },
  "no-fallthrough": {
    violation: `function f(x: number) {\n  switch (x) {\n    case 1:\n      console.log("one");\n    // expect: no-fallthrough error\n    case 2:\n      console.log("two");\n      break;\n  }\n}\nvoid f;\n`,
  },
  "no-func-assign": {
    violation: `function g() { return 1; }\n// expect: no-func-assign error\ng = function () { return 2; };\n`,
  },
  "no-inner-declarations": {
    violation: `function outer() {\n  if (1) {\n    // expect: no-inner-declarations error\n    function inner() {}\n    inner();\n  }\n}\nouter();\n`,
  },
  "no-irregular-whitespace": {
    violation: `// expect: no-irregular-whitespace error\nconst a = 1;\nvoid a;\n`,
  },
  "no-loss-of-precision": {
    violation: `// expect: no-loss-of-precision error\nconst big = 9007199254740993;\nvoid big;\n`,
  },
  "no-misleading-character-class": {
    violation: `// expect: no-misleading-character-class error\nconst r = /[\u{1f44d}]/;\nvoid r;\n`,
  },
  "no-obj-calls": {
    violation: `// expect: no-obj-calls error\n(Math as any)();\n`,
  },
  "no-promise-executor-return": {
    violation: `// expect: no-promise-executor-return error\nnew Promise((resolve) => resolve(1));\n`,
  },
  "no-prototype-builtins": {
    violation: `const o: any = {};\n// expect: no-prototype-builtins error\no.hasOwnProperty("x");\n`,
  },
  "no-self-assign": {
    violation: `let x = 1;\n// expect: no-self-assign error\nx = x;\nvoid x;\n`,
  },
  "no-self-compare": {
    violation: `function f(a: number) {\n  // expect: no-self-compare error\n  return a === a;\n}\nvoid f;\n`,
  },
  "no-sparse-arrays": {
    violation: `// expect: no-sparse-arrays error\nconst a = [1, , 3];\nvoid a;\n`,
  },
  "no-template-curly-in-string": {
    violation: "// expect: no-template-curly-in-string error\nconst s: string = \"hello ${name}\";\nvoid s;\n",
  },
  "no-unsafe-finally": {
    violation: `function f() {\n  try {\n    throw new Error("x");\n  } finally {\n    // expect: no-unsafe-finally error\n    return 1;\n  }\n}\nvoid f;\n`,
  },
  "no-unsafe-negation": {
    violation: `function f(a: any, b: any) {\n  // expect: no-unsafe-negation error\n  return !a in b;\n}\nvoid f;\n`,
  },
  "use-isnan": {
    violation: `function f(x: number) {\n  // expect: use-isnan error\n  return x === NaN;\n}\nvoid f;\n`,
  },
  "valid-typeof": {
    violation: `function f(x: any) {\n  // expect: valid-typeof error\n  return typeof x === "stirng";\n}\nvoid f;\n`,
  },

  // -------- ESLint Suggestions --------
  eqeqeq: {
    violation: `function f(a: any, b: any) {\n  // expect: eqeqeq error\n  return a == b;\n}\nvoid f;\n`,
  },
  "no-alert": {
    violation: `// expect: no-alert error\n(alert as any)("hi");\n`,
  },
  "no-array-constructor": {
    violation: `// expect: no-array-constructor error\nconst a = new Array();\nvoid a;\n`,
  },
  "no-bitwise": {
    violation: `function f(a: number, b: number) {\n  // expect: no-bitwise error\n  return a & b;\n}\nvoid f;\n`,
  },
  "no-caller": {
    violation: `function f() {\n  // expect: no-caller error\n  return (arguments as any).callee;\n}\nvoid f;\n`,
  },
  "no-case-declarations": {
    violation: `function f(x: number) {\n  switch (x) {\n    case 1:\n      // expect: no-case-declarations error\n      let y = 1;\n      return y;\n  }\n  return 0;\n}\nvoid f;\n`,
  },
  "no-console": {
    violation: `// expect: no-console error\nconsole.log("hi");\n`,
  },
  "no-continue": {
    violation: `for (let i = 0; i < 3; i++) {\n  // expect: no-continue error\n  if (i === 1) continue;\n  console.log(i);\n}\n`,
  },
  "no-delete-var": {
    violation: `let a: any = 1;\n// expect: no-delete-var error\ndelete a;\nvoid a;\n`,
  },
  "no-empty": {
    violation: `function f(x: number) {\n  // expect: no-empty error\n  if (x === 0) {}\n}\nvoid f;\n`,
  },
  "no-empty-function": {
    violation: `// expect: no-empty-function error\nfunction f(): void {}\nf();\n`,
  },
  "no-eq-null": {
    violation: `function f(x: any) {\n  // expect: no-eq-null error\n  return x == null;\n}\nvoid f;\n`,
  },
  "no-eval": {
    violation: `// expect: no-eval error\neval("1");\n`,
  },
  "no-extra-bind": {
    violation: `// expect: no-extra-bind error\nconst f = (() => 1).bind({});\nvoid f;\n`,
  },
  "no-extra-boolean-cast": {
    violation: `function f(x: any) {\n  // expect: no-extra-boolean-cast error\n  if (!!x) { return 1; }\n  return 0;\n}\nvoid f;\n`,
  },
  "no-iterator": {
    violation: `const o: any = {};\n// expect: no-iterator error\nvoid o.__iterator__;\n`,
  },
  "no-labels": {
    violation: `// expect: no-labels error\nouter: for (let i = 0; i < 3; i++) { break outer; }\n`,
  },
  "no-lone-blocks": {
    violation: `// expect: no-lone-blocks error\n{\n  console.log("hi");\n}\n`,
  },
  "no-lonely-if": {
    violation: `function f(a: any, b: any) {\n  if (a) {\n    return 1;\n  } else {\n    // expect: no-lonely-if error\n    if (b) {\n      return 2;\n    }\n  }\n  return 0;\n}\nvoid f;\n`,
  },
  "no-multi-assign": {
    violation: `let a: any, b: any;\n// expect: no-multi-assign error\na = b = 1;\nvoid a; void b;\n`,
  },
  "no-multi-str": {
    violation: "// expect: no-multi-str error\nconst s: string = \"line1 \\\nline2\";\nvoid s;\n",
  },
  "no-negated-condition": {
    violation: `function f(a: any) {\n  // expect: no-negated-condition error\n  if (!a) { return 1; } else { return 2; }\n}\nvoid f;\n`,
  },
  "no-nested-ternary": {
    violation: `function f(a: any, b: any, c: any, d: any, e: any) {\n  // expect: no-nested-ternary error\n  return a ? b : c ? d : e;\n}\nvoid f;\n`,
  },
  "no-new": {
    violation: `class Thing {}\n// expect: no-new error\nnew Thing();\n`,
  },
  "no-new-func": {
    violation: `// expect: no-new-func error\nconst f = new Function("a", "return a");\nvoid f;\n`,
  },
  "no-new-wrappers": {
    violation: `// expect: no-new-wrappers error\nconst s = new String("a");\nvoid s;\n`,
  },
  "no-object-constructor": {
    violation: `// expect: no-object-constructor error\nconst o = new Object();\nvoid o;\n`,
  },
  "no-octal": {
    violation: `// expect: no-octal error\nconst n = 010;\nvoid n;\n`,
  },
  "no-octal-escape": {
    violation: "// expect: no-octal-escape error\nconst s: string = \"\\251\";\nvoid s;\n",
  },
  "no-plusplus": {
    violation: `let i = 0;\n// expect: no-plusplus error\ni++;\nvoid i;\n`,
  },
  "no-proto": {
    violation: `const o: any = {};\n// expect: no-proto error\nvoid o.__proto__;\n`,
  },
  "no-regex-spaces": {
    violation: `// expect: no-regex-spaces error\nconst r = /a  b/;\nvoid r;\n`,
  },
  "no-return-assign": {
    violation: `function f(a: any) {\n  // expect: no-return-assign error\n  return a = 1;\n}\nvoid f;\n`,
  },
  "no-script-url": {
    violation: `// expect: no-script-url error\nconst u: string = "javascript:alert(1)";\nvoid u;\n`,
  },
  "no-sequences": {
    violation: `function f(a: any, b: any) {\n  // expect: no-sequences error\n  return a, b;\n}\nvoid f;\n`,
  },
  "no-shadow-restricted-names": {
    violation: `// expect: no-shadow-restricted-names error\nfunction f(undefined: number) { return undefined; }\nf(1);\n`,
  },
  "no-throw-literal": {
    violation: `function f() {\n  // expect: no-throw-literal error\n  throw "literal";\n}\nvoid f;\n`,
  },
  "no-undef-init": {
    violation: `// expect: no-undef-init error\nlet a: any = undefined;\nvoid a;\n`,
  },
  "no-undefined": {
    violation: `// expect: no-undefined error\nconst x = undefined;\nvoid x;\n`,
  },
  "no-unneeded-ternary": {
    violation: `function f(x: any) {\n  // expect: no-unneeded-ternary error\n  return x ? true : false;\n}\nvoid f;\n`,
  },
  "no-unused-expressions": {
    violation: `function f(a: any, b: any) {\n  // expect: no-unused-expressions error\n  (a, b);\n}\nvoid f;\n`,
  },
  "no-useless-call": {
    violation: `function f() {}\n// expect: no-useless-call error\nf.call(undefined, 1);\n`,
  },
  "no-useless-catch": {
    violation: `function f() {\n  // expect: no-useless-catch error\n  try {\n    return 1;\n  } catch (e) {\n    throw e;\n  }\n}\nvoid f;\n`,
  },
  "no-useless-computed-key": {
    violation: `// expect: no-useless-computed-key error\nconst o = { ["foo"]: 1 };\nvoid o;\n`,
  },
  "no-useless-concat": {
    violation: `// expect: no-useless-concat error\nconst s = "a" + "b";\nvoid s;\n`,
  },
  "no-useless-rename": {
    violation: `const obj: any = { foo: 1 };\n// expect: no-useless-rename error\nconst { foo: foo } = obj;\nvoid foo;\n`,
  },
  "no-var": {
    violation: `// expect: no-var error\nvar legacy = 1;\nvoid legacy;\n`,
  },
  "no-with": {
    violation: `function f(o: any) {\n  // expect: no-with error\n  with (o) { console.log("hi"); }\n}\nvoid f;\n`,
  },
  "object-shorthand": {
    violation: `const x = 1;\n// expect: object-shorthand error\nconst o = { x: x };\nvoid o;\n`,
  },
  "operator-assignment": {
    violation: `let x = 1;\n// expect: operator-assignment error\nx = x + 1;\nvoid x;\n`,
  },
  "prefer-exponentiation-operator": {
    violation: `// expect: prefer-exponentiation-operator error\nconst a = Math.pow(2, 3);\nvoid a;\n`,
  },
  "prefer-spread": {
    violation: `function f(a: number, b: number) { return a + b; }\nconst args: [number, number] = [1, 2];\n// expect: prefer-spread error\nf.apply(null, args);\n`,
  },
  "prefer-template": {
    violation: `const name = "world";\n// expect: prefer-template error\nconst s = "hi " + name + "!";\nvoid s;\n`,
  },
  radix: {
    violation: `// expect: radix error\nconst n = parseInt("42");\nvoid n;\n`,
  },
  "require-yield": {
    violation: `// expect: require-yield error\nfunction* gen() { return 1; }\nvoid gen;\n`,
  },
  "vars-on-top": {
    violation: `function f() {\n  console.log("hi");\n  // expect: vars-on-top error\n  var a = 1;\n  void a;\n}\nf();\n`,
  },
  yoda: {
    violation: `function f(x: number) {\n  // expect: yoda error\n  return 1 === x;\n}\nvoid f;\n`,
  },

  // -------- @typescript-eslint --------
  "adjacent-overload-signatures": {
    violation: `interface I {\n  foo(): void;\n  bar(): void;\n  // expect: adjacent-overload-signatures error\n  foo(x: number): void;\n}\ndeclare const i: I;\nvoid i;\n`,
  },
  "array-type": {
    violation: `// expect: array-type error\nconst a: Array<string> = [];\nvoid a;\n`,
  },
  "ban-ts-comment": {
    violation: `// @ts-ignore\n// expect: ban-ts-comment error\nconst a: number = "oops" as any;\nvoid a;\n`,
  },
  "ban-tslint-comment": {
    violation: `// expect: ban-tslint-comment error\n// tslint:disable\nconst x = 1;\nvoid x;\n`,
  },
  "consistent-indexed-object-style": {
    violation: `// expect: consistent-indexed-object-style error\ntype Dict = { [key: string]: number };\nconst d: Dict = {};\nvoid d;\n`,
  },
  "consistent-type-imports": {
    violation: `// expect: consistent-type-imports error\nimport { Foo } from "./types-fixture";\nconst x: Foo | null = null;\nvoid x;\n`,
    extraSources: {
      "src/types-fixture.ts": `export interface Foo { id: number; }\n`,
    },
  },
  "no-array-delete": {
    violation: `const arr: number[] = [1, 2, 3];\n// expect: no-array-delete error\ndelete arr[0];\nvoid arr;\n`,
  },
  "no-confusing-non-null-assertion": {
    violation: `function f(x: number | null, y: number) {\n  // expect: no-confusing-non-null-assertion error\n  return x! === y;\n}\nvoid f;\n`,
  },
  "no-duplicate-enum-values": {
    violation: `enum E {\n  A = 1,\n  B = 2,\n  // expect: no-duplicate-enum-values error\n  C = 1,\n}\nvoid E.A;\n`,
  },
  "no-empty-interface": {
    violation: `// expect: no-empty-interface error\ninterface Empty {}\nconst e: Empty = {};\nvoid e;\n`,
  },
  "no-empty-object-type": {
    violation: `// expect: no-empty-object-type error\ntype T = {};\nconst v: T = {};\nvoid v;\n`,
  },
  "no-explicit-any": {
    violation: `function f(\n  // expect: no-explicit-any error\n  x: any,\n): number { return Number(x); }\nf(0);\n`,
  },
  "no-extra-non-null-assertion": {
    violation: `function f(x: number | null) {\n  // expect: no-extra-non-null-assertion error\n  return x!!;\n}\nvoid f;\n`,
  },
  "no-inferrable-types": {
    violation: `// expect: no-inferrable-types error\nconst a: number = 5;\nvoid a;\n`,
  },
  "no-misused-new": {
    violation: `interface I {\n  // expect: no-misused-new error\n  constructor(): void;\n}\ndeclare const i: I;\nvoid i;\n`,
  },
  "no-namespace": {
    violation: `// expect: no-namespace error\nnamespace Foo { export const x = 1; }\nvoid Foo.x;\n`,
  },
  "no-non-null-asserted-optional-chain": {
    violation: `const o: { a?: { b: number } } = {} as any;\n// expect: no-non-null-asserted-optional-chain error\nconst x = o?.a!;\nvoid x;\n`,
  },
  "no-non-null-assertion": {
    violation: `function f(x: number | null): number {\n  // expect: no-non-null-assertion error\n  return x!;\n}\nf(1);\n`,
  },
  "no-require-imports": {
    violation: `// expect: no-require-imports error\nconst fs = require("fs");\nvoid fs;\n`,
  },
  "no-this-alias": {
    violation: `class A {\n  m() {\n    // expect: no-this-alias error\n    const self = this;\n    return self;\n  }\n}\nvoid A;\n`,
  },
  "prefer-as-const": {
    violation: `// expect: prefer-as-const error\nconst a = "foo" as "foo";\nvoid a;\n`,
  },
  "prefer-enum-initializers": {
    violation: `enum E {\n  // expect: prefer-enum-initializers error\n  A,\n}\nvoid E.A;\n`,
  },
  "prefer-for-of": {
    violation: `const arr: number[] = [1, 2, 3];\n// expect: prefer-for-of error\nfor (let i = 0; i < arr.length; i++) {\n  console.log(arr[i]);\n}\n`,
  },
  "prefer-function-type": {
    violation: `// expect: prefer-function-type error\ninterface F { (x: number): string; }\ndeclare const f: F;\nvoid f;\n`,
  },
  "prefer-namespace-keyword": {
    violation: `// expect: prefer-namespace-keyword error\nmodule Foo { export const x = 1; }\nvoid Foo.x;\n`,
  },
  "triple-slash-reference": {
    violation: `// expect: triple-slash-reference error\n/// <reference path="./other-fixture.d.ts" />\nconst x = 1;\nvoid x;\n`,
    extraSources: {
      "src/other-fixture.d.ts": `export {};\n`,
    },
  },
};

let createdCount = 0;
let skippedCount = 0;
for (const [rule, fixture] of Object.entries(fixtures)) {
  const ruleDir = path.join(casesDir, rule);
  fs.mkdirSync(ruleDir, { recursive: true });
  const target = path.join(ruleDir, "violation.ts");
  if (fs.existsSync(target)) {
    skippedCount++;
    continue;
  }
  fs.writeFileSync(target, fixture.violation, "utf8");
  if (fixture.extraSources) {
    for (const [relPath, content] of Object.entries(fixture.extraSources)) {
      fs.mkdirSync(path.join(ruleDir, path.dirname(relPath)), { recursive: true });
      fs.writeFileSync(path.join(ruleDir, relPath), content, "utf8");
    }
  }
  createdCount++;
}

console.log(`Seeded ${createdCount} fixtures (${skippedCount} already existed).`);
