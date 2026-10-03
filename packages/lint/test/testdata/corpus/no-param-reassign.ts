function reassignSimple(x: number): number {
  // expect: no-param-reassign error
  x = 1;
  return x;
}

function reassignCompound(n: number): number {
  // expect: no-param-reassign error
  n += 5;
  return n;
}

function reassignPrefix(i: number): number {
  // expect: no-param-reassign error
  ++i;
  return i;
}

const reassignPostfix = (i: number): number => {
  // expect: no-param-reassign error
  i--;
  return i;
};

// Local variable assignment is fine.
function localOk(x: number): number {
  let total = 0;
  total += x;
  return total;
}

// Property mutation is left alone unless the `props` option is enabled.
function propertyOk(obj: { count: number }): number {
  obj.count = 5;
  return obj.count;
}

// Reassigning a local variable in an inner function — the outer
// parameter `x` is only read, never written.
function innerOk(x: number): () => number {
  let total = x;
  return () => {
    total = total + 1;
    return total;
  };
}

JSON.stringify([
  reassignSimple(0),
  reassignCompound(0),
  reassignPrefix(0),
  reassignPostfix(0),
  localOk(0),
  propertyOk({ count: 0 }),
  innerOk(0)(),
]);
