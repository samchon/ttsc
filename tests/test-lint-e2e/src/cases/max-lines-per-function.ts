// Positive: the function body spans more than the default 50 lines
// between its opening and closing braces, including the deliberate
// blank-line padding below.
// expect: max-lines-per-function error
function longBody(): number {
  let total = 0;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  total += 1;
  return total;
}

// Negative: a single-line function trivially fits under the limit.
function short(): number {
  return 0;
}

JSON.stringify({
  longBody: longBody(),
  short: short(),
});
