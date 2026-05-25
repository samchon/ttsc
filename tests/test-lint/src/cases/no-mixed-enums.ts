enum Mixed {
  A = 1,
  // expect: noMixedEnums error
  B = "two",
}
JSON.stringify(Mixed.A);
