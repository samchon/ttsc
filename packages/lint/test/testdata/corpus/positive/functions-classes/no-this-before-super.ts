class Base {
  protected value: number = 0;
  constructor(initial: number) {
    this.value = initial;
  }
}
class Child extends Base {
  constructor() {
    // expect: no-this-before-super error
    this.value = 1;
    super(0);
  }
}
JSON.stringify({ Base, Child });
