declare const condition: boolean;

function f(x: number) {
  switch (x) {
    case 1:
      console.log("one");
    // expect: no-fallthrough error
    // @ts-ignore
    case 2:
      console.log("two");
      // falls through
    case 3:
      if (condition) {
        return;
      } else {
        throw new Error("stop");
      }
    case 4:
      console.log("four");
      break;
  }
}
JSON.stringify(f);
