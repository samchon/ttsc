function outer() {
  if (1) {
    // expect: no-inner-declarations error
    function inner() {}
    inner();
  }
}
outer();
