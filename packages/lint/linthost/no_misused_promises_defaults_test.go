package linthost

import "testing"

// TestNoMisusedPromisesDefaults covers every default rule family and its
// Promise-aware negative controls.
//
//  1. Exercise conditions, arguments, predicates, spreads, inheritance,
//     disposal, variables, object properties, returns, and JSX attributes.
//  2. Pair them with synchronous and Promise-aware controls.
//  3. Require only the Promise-producing boundaries to report.
// @evidence contracts/testing.md#behavioral-verification Every default misuse family must inspect its supported Promise boundary.
// @evidence contracts/testing.md#independent-expectations Authored markers fix the complete error-line multiset across conditions, predicates, spreads, inheritance, disposal, callbacks, returns and JSX.
// @evidence contracts/testing.md#distinguishing-cases Synchronous disposal, await-using and Promise-aware arguments remain clean; the Promise-or-boolean condition boundary stays intentionally unreported.
// @evidence contracts/testing.md#execution-ownership TestNoMisusedPromisesDefaults executes the in-process check command over a real Program/Checker; disposable fixture configuration feeds that operation without a compiler child, installation or native plugin build.
func TestNoMisusedPromisesDefaults(t *testing.T) {
  assertNoMisusedPromisesCase(t, "main.tsx", `declare function consume(callback: () => void): void;
declare function consumeAsync(callback: () => Promise<void>): void;
declare global { namespace JSX { interface IntrinsicElements { button: { onClick?: () => void } } } }

// expect: typescript/no-misused-promises error
consume(async () => {});
// expect: typescript/no-misused-promises error
consume(() => Promise.resolve());
consumeAsync(async () => {});

// expect: typescript/no-misused-promises error
[1].filter(() => Promise.resolve(true));
// expect: typescript/no-misused-promises error
[1].findIndex(() => Promise.resolve(true));
const promisedObject = Promise.resolve({ value: 1 });
// expect: typescript/no-misused-promises error
const spread = { ...promisedObject };
declare const maybePromisedObject: Promise<{ value: number }> | { value: number };
// expect: typescript/no-misused-promises error
const maybeSpread = { ...maybePromisedObject };

interface Contract { execute(): void; }
// expect: typescript/no-misused-promises error
class Implementation implements Contract { async execute(): Promise<void> {} }

function resources(): void {
  // expect: typescript/no-misused-promises error
  using invalid = { async [Symbol.dispose](): Promise<void> {} };
  using valid = { [Symbol.dispose](): void {} };
  void [invalid, valid];
}
async function asyncResources(): Promise<void> {
  await using valid = { async [Symbol.asyncDispose](): Promise<void> {} };
  void valid;
}
// expect: typescript/no-misused-promises error
const annotatedResource: Disposable = { async [Symbol.dispose](): Promise<void> {} };

// expect: typescript/no-misused-promises error
const variable: () => void = async () => {};
let reassigned: () => void = () => {};
// expect: typescript/no-misused-promises error
reassigned = async () => {};
// expect: typescript/no-misused-promises error
const property: { run: () => void } = { run: async () => {} };
const shorthandRun = async () => {};
// expect: typescript/no-misused-promises error
const shorthandProperty: { shorthandRun: () => void } = { shorthandRun };
const methodProperty: { run(): void } = {
  // expect: typescript/no-misused-promises error
  async run(): Promise<void> {},
};
function factory(): () => void {
  // expect: typescript/no-misused-promises error
  return async () => {};
}
// expect: typescript/no-misused-promises error
const view = <button onClick={() => Promise.resolve()} />;

declare const condition: Promise<boolean>;
// expect: typescript/no-misused-promises error
if (condition) { void spread; }
declare const maybeCondition: Promise<boolean> | boolean;
if (maybeCondition) { void maybeSpread; }
declare const gate: boolean;
// expect: typescript/no-misused-promises error
const nestedLogical = gate || (condition && true);

void [Implementation, resources, asyncResources, annotatedResource, variable, reassigned, property, shorthandProperty, methodProperty, factory, view, nestedLogical];
export {};
`, nil)
}
