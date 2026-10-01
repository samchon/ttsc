// Positive: eleven top-level statements in the function body exceed the
// default ceiling of ten.
// expect: max-statements error
function eleven(): number {
  const a = 1;
  const b = 2;
  const c = 3;
  const d = 4;
  const e = 5;
  const f = 6;
  const g = 7;
  const h = 8;
  const i = 9;
  const j = 10;
  return a + b + c + d + e + f + g + h + i + j;
}

// Negative: exactly ten statements sits at the limit, not over it.
function ten(): number {
  const a = 1;
  const b = 2;
  const c = 3;
  const d = 4;
  const e = 5;
  const f = 6;
  const g = 7;
  const h = 8;
  const i = 9;
  return a + b + c + d + e + f + g + h + i;
}

JSON.stringify({
  eleven: eleven(),
  ten: ten(),
});
