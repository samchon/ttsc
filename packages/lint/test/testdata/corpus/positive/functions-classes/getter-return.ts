class Foo {
  // expect: getter-return error
  get value(): number {
    JSON.stringify({});
  }
}
JSON.stringify(Foo);
