// expect: functional/functional-parameters error
function variadic(...args: number[]): number {
  return args.length;
}

JSON.stringify(variadic);
