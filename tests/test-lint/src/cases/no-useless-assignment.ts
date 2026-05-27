// Positive: two consecutive assignments to the same identifier with
// no intervening read of the prior value.
function deadStore(): number {
  let x = 0;
  // expect: no-useless-assignment error
  x = 1;
  x = 2;
  return x;
}

// Positive: another adjacent overwrite further down a block.
function deadStoreInBlock(): string {
  let label = "";
  if (Math.random() > 0.5) {
    // expect: no-useless-assignment error
    label = "first";
    label = "second";
  }
  return label;
}

// Negative: the second statement reads the prior value, so the first
// assignment is load-bearing.
function readsPrior(): number {
  let x = 0;
  x = 1;
  x = x + 2;
  return x;
}

// Negative: an unrelated statement separates the two writes — the
// rule only flags syntactically adjacent overwrites.
function withInterleavedRead(): number {
  let x = 0;
  x = 1;
  JSON.stringify(x);
  x = 2;
  return x;
}

// Negative: different identifiers.
function differentTargets(): number {
  let a = 0;
  let b = 0;
  a = 1;
  b = 2;
  return a + b;
}

JSON.stringify({
  deadStore,
  deadStoreInBlock,
  readsPrior,
  withInterleavedRead,
  differentTargets,
});
