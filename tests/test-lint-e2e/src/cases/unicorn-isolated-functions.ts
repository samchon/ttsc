declare function makeSynchronous<T>(fn: T): T;

const captured = "hi";

// expect: unicorn/isolated-functions error
makeSynchronous(() => captured.slice());

/** @isolated */
function viaComment(): string {
  // expect: unicorn/isolated-functions error
  // expect: unicorn/isolated-functions error
  return captured.slice() + viaComment.name;
}
viaComment();

makeSynchronous(function (this: { key: string }) {
  // expect: unicorn/isolated-functions error
  return this.key;
});

// Clean twin: parameters, locals, and ambient globals stay usable inside the
// isolated function.
makeSynchronous((prefix: string) => {
  const local = "ok";
  console.log(local);
  return prefix + local + new Array(1).length;
});
