// Positive: a closure captures both an outer binding written after the loop
// begins and a var loop counter shared by every iteration.
let mutable = 0;
for (var index = 0; index < 2; index++) {
  // expect: no-loop-func error
  const unsafe = () => mutable + index;
  void unsafe;
}
mutable = 1;

// Negative: const and per-iteration let bindings cannot change underneath a
// closure from a different iteration.
const fixed = 1;
for (let iteration = 0; iteration < 2; iteration++) {
  const safe = () => fixed + iteration;
  const noCapture = () => 42;
  void [safe, noCapture];
}

// Negative: an unreferenced synchronous IIFE completes in this iteration.
for (let iteration = 0; iteration < 1; iteration++) {
  (() => mutable)();
}

// Positive: the nested closure returned by an IIFE can escape the iteration.
for (let iteration = 0; iteration < 1; iteration++) {
  // expect: no-loop-func error
  const escaped = (() => () => mutable)();
  void escaped;
}
mutable = 2;

JSON.stringify({ mutable, fixed });
