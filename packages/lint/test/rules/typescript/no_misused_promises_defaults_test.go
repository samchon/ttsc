package linthost

import "testing"

// TestNoMisusedPromisesDefaults covers every default rule family and its
// Promise-aware negative controls.
//
// 1. Exercise conditions, arguments, predicates, spreads, inheritance,
//    disposal, variables, object properties, returns, and JSX attributes.
// 2. Pair them with synchronous and Promise-aware controls.
// 3. Require only the Promise-producing boundaries to report.
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
const promisedObject = Promise.resolve({ value: 1 });
// expect: typescript/no-misused-promises error
const spread = { ...promisedObject };

interface Contract { execute(): void; }
// expect: typescript/no-misused-promises error
class Implementation implements Contract { async execute(): Promise<void> {} }

function resources(): void {
  // expect: typescript/no-misused-promises error
  using invalid = { async [Symbol.dispose](): Promise<void> {} };
  using valid = { [Symbol.dispose](): void {} };
  void [invalid, valid];
}

// expect: typescript/no-misused-promises error
const variable: () => void = async () => {};
// expect: typescript/no-misused-promises error
const property: { run: () => void } = { run: async () => {} };
function factory(): () => void {
  // expect: typescript/no-misused-promises error
  return async () => {};
}
// expect: typescript/no-misused-promises error
const view = <button onClick={() => Promise.resolve()} />;

declare const condition: Promise<boolean>;
// expect: typescript/no-misused-promises error
if (condition) { void spread; }

void [Implementation, resources, variable, property, factory, view];
export {};
`, nil)
}
