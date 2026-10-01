// Positive: a non-arrow function that reads from `arguments` should
// declare its variadic contract as `(...args)` instead.
function sumLegacy() {
  // expect: prefer-rest-params error
  return Array.prototype.slice.call(arguments).reduce(
    (a: number, b: number) => a + b,
    0,
  );
}

// Negative: rest parameters express the variadic shape on the signature.
function sumModern(...args: number[]) {
  return args.reduce((a, b) => a + b, 0);
}

// Negative: arrow functions do not have their own `arguments`, so reads
// here resolve to the enclosing function and the rule does not apply.
const passthrough = () => arguments;

JSON.stringify({
  legacy: sumLegacy.call(null, 1, 2),
  modern: sumModern(1, 2),
  passthrough: passthrough,
});
