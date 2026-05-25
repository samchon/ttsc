function outer() {
  if (1) {
    // expect: noInnerDeclarations error
    function inner() {}
    inner();
  }
}
outer();
