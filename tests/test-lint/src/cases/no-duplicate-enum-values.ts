enum E {
  A = 1,
  B = 2,
  // expect: noDuplicateEnumValues error
  C = 1,
}
JSON.stringify(E.A);
