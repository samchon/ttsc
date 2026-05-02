function f(x: number) {
  switch (x) {
    case 1:
      console.log("one");
    // expect: no-fallthrough error
    case 2:
      console.log("two");
      break;
  }
}
JSON.stringify(f);