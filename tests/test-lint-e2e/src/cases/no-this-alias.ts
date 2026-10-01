class A {
  m() {
    // expect: typescript/no-this-alias error
    const self = this;
    return self;
  }
}
JSON.stringify(A);
