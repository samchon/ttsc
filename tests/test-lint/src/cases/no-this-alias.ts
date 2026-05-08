class A {
  m() {
    // expect: no-this-alias error
    const self = this;
    return self;
  }
}
JSON.stringify(A);
