enum E {
  // expect: prefer-enum-initializers error
  A,
}
JSON.stringify(E.A);
