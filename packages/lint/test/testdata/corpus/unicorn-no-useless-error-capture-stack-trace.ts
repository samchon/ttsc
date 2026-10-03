class MyError extends Error {
  constructor(msg: string) {
    super(msg);
    // expect: unicorn/no-useless-error-capture-stack-trace error
    Error.captureStackTrace(this, MyError);
  }
}
void new MyError("x");
