declare const condition: boolean;
declare function consume(value: unknown): void;

// expect: no-promise-executor-return error
new Promise((resolve) => resolve(1));

new Promise(() => {
  if (condition) {
    // expect: no-promise-executor-return error
    return 1;
  }
  return;
});

new Promise(function () {
  // expect: no-promise-executor-return error
  return 2;
});

new Promise(() => {
  const nested = () => 3;
  consume(nested);
  return;
});

function shadowed(Promise: new (executor: () => unknown) => unknown) {
  new Promise(() => 4);
}
consume(shadowed);
