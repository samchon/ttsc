class A {
  m() {
    // expect: noThisAlias error
    const self = this;
    return self;
  }
}
JSON.stringify(A);
