function f(x: number) {
  switch (x) {
    case 1:
      console.log("one");
    // expect: noFallthrough error
    case 2:
      console.log("two");
      break;
  }
}
JSON.stringify(f);
