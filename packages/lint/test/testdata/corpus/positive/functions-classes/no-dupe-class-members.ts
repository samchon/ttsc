class Foo {
  run(): number {
    return 1;
  }
  // expect: no-dupe-class-members error
  run(): number {
    return 2;
  }
}
JSON.stringify(Foo);
