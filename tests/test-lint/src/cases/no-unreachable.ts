function afterReturn(): number {
  return 1;
  // expect: no-unreachable error
  console.log("dead");
}

function afterThrow(): void {
  throw new Error("boom");
  // expect: no-unreachable error
  console.log("dead");
}

function loop(): void {
  for (let i = 0; i < 3; i += 1) {
    if (i === 0) {
      continue;
      // expect: no-unreachable error
      console.log("dead");
    }
    if (i === 2) {
      break;
      // expect: no-unreachable error
      console.log("dead");
    }
  }
}

// Negative: a function declaration after the terminator is hoisted and
// remains callable from earlier statements, so it is not dead code.
function withHoistedDecl(): number {
  return helper();
  function helper(): number {
    return 7;
  }
}

JSON.stringify({
  afterReturn: afterReturn(),
  loop,
  afterThrow,
  withHoistedDecl: withHoistedDecl(),
});
