function deadStore(): number {
  let x = 0;
  // expect: no-useless-assignment error
  x = 1;
  x = 2;
  return x;
}
function readsPrior(): number {
  let x = 0;
  x = 1;
  x = x + 2;
  return x;
}
function withInterleavedRead(): number {
  let x = 0;
  x = 1;
  JSON.stringify(x);
  x = 2;
  return x;
}
function differentTargets(): number {
  let a = 0;
  let b = 0;
  a = 1;
  b = 2;
  return a + b;
}
JSON.stringify({ deadStore, readsPrior, withInterleavedRead, differentTargets });
