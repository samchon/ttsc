class Foo {
  // expect: typescript/explicit-member-accessibility error
  value: number = 0;
}
JSON.stringify(Foo);
