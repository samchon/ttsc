declare const list: readonly number[];

// Positive: a plain function expression used as the `.map` callback.
list.map(
  // expect: prefer-arrow-callback error
  function (n: number) {
    return n * 2;
  },
);

// Positive: a function expression passed to setTimeout. The arrow form
// is the obvious replacement.
setTimeout(
  // expect: prefer-arrow-callback error
  function () {
    JSON.stringify("done");
  },
  10,
);

// Negative: an arrow function — already the recommended form.
list.map((n) => n + 1);

// Negative: a generator function expression cannot be expressed as an
// arrow at all.
const gen = function* () {
  yield 1;
};
JSON.stringify([...gen()]);

// Negative: the body reads `this`, so converting to an arrow would
// capture the surrounding `this` and change behaviour.
function runner(this: { value: number }) {
  list.map(
    function (this: { value: number }, n: number) {
      return n + this.value;
    },
    this,
  );
}
runner.call({ value: 1 });

// Negative: the body reads `arguments`. Arrows have no `arguments`
// binding, so the conversion would break.
function variadic() {
  return [].map.call(
    arguments,
    function () {
      // eslint-disable-next-line prefer-rest-params
      return arguments.length;
    },
  );
}
JSON.stringify(variadic(1, 2, 3));
