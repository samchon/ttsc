class C {
  field: number;
  constructor() {
    // expect: unicorn/prefer-class-fields error
    this.field = 1;
  }
}
