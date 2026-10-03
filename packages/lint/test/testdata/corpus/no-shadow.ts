// Positive: an inner `let` shadows the outer-scope binding of the same name.
let outer: number = 1;
function f(): number {
  // expect: no-shadow error
  let outer: number = 2;
  return outer;
}

// Negative: a sibling block introduces its own binding with a distinct name.
function g(): number {
  let inner: number = 3;
  return inner;
}

void [outer, f, g];
