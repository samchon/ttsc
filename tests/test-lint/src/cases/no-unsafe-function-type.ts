// expect: noUnsafeFunctionType error
type Callback = Function;

JSON.stringify({} as Callback);
