enum Mixed {
  A = 1,
  // expect: no-mixed-enums error
  B = "two",
}
JSON.stringify(Mixed.A);
