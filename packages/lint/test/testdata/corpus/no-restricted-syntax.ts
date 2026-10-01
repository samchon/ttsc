// @ttsc-corpus-options: no-restricted-syntax "LabeledStatement"

function runLabeled(): number {
  let acc = 0;
  // expect: no-restricted-syntax error
  outer: for (let i = 0; i < 3; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      if (i + j > 3) break outer;
      acc += 1;
    }
  }
  return acc;
}

// Negative: ordinary statements stay silent.
function plain(value: number): number {
  return value + 1;
}

JSON.stringify({
  runLabeled: runLabeled(),
  plain: plain(3),
});
