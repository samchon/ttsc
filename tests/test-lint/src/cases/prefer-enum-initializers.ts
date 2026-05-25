enum E {
  // expect: preferEnumInitializers error
  A,
}
JSON.stringify(E.A);
