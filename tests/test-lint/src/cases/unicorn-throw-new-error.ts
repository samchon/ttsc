declare const ValidationError: any;
declare const ns: any;
declare const getError: any;

function builtinCallee() {
  // expect: unicorn/throw-new-error error
  throw Error("oops");
}

function customErrorCallee() {
  // expect: unicorn/throw-new-error error
  throw ValidationError("bad");
}

function memberCallee() {
  // expect: unicorn/throw-new-error error
  throw ns.CustomError("bad");
}

function alreadyConstructed() {
  throw new ValidationError("bad");
}

function computedCallee() {
  throw ns["CustomError"]("bad");
}

function optionalCallee() {
  throw ns?.CustomError("bad");
}

function nonErrorCallee() {
  throw getError();
}
