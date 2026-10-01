class C {
  m() {
    // expect: unicorn/no-this-assignment error
    const self = this;
    return self;
  }
}
