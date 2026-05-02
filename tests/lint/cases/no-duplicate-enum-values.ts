enum E {
  A = 1,
  B = 2,
  // expect: no-duplicate-enum-values error
  C = 1,
}
JSON.stringify(E.A);