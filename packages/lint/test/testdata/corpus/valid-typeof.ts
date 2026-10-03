function f(x: any) {
  // expect: valid-typeof error
  const typo = typeof x === "stirng";
  const known = typeof x === "string";
  const ordered = typeof x < "m";
  const orderedOrEqual = typeof x >= "z";
  return [typo, known, ordered, orderedOrEqual];
}
JSON.stringify(f);
