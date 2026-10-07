enum E {
  // expect: typescript/prefer-enum-initializers error
  A,
}
JSON.stringify(E.A);
