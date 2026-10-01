enum Mixed {
  A = 1,
  // expect: typescript/no-mixed-enums error
  B = "two",
}
JSON.stringify(Mixed.A);
