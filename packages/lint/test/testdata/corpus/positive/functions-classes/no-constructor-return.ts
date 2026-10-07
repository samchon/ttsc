class Foo {
  value: number;
  constructor(initial: number) {
    this.value = initial;
    // expect: no-constructor-return error
    return { handled: true } as unknown as Foo;
  }
}
JSON.stringify(Foo);
