declare function getPromise(): Promise<number>;

async function returnInsideTry(): Promise<number> {
  try {
    // expect: typescript/return-await error
    return getPromise();
  } catch (err) {
    JSON.stringify(err);
    return 0;
  }
}

async function returnInsideTryWithFinally(): Promise<number> {
  try {
    // expect: typescript/return-await error
    return getPromise();
  } finally {
    JSON.stringify("cleanup");
  }
}

async function returnInsideFinally(): Promise<number> {
  try {
    return 0;
  } finally {
    // expect: typescript/return-await error
    return getPromise();
  }
}

async function returnInsideCatchWithOuterCatch(): Promise<number> {
  try {
    try {
      return 0;
    } catch (inner) {
      JSON.stringify(inner);
      // expect: typescript/return-await error
      return getPromise();
    }
  } catch (outer) {
    JSON.stringify(outer);
    return 0;
  }
}

async function returnInsideNestedTry(): Promise<number> {
  try {
    try {
      // expect: typescript/return-await error
      return getPromise();
    } finally {
      JSON.stringify("inner");
    }
  } catch (err) {
    JSON.stringify(err);
    return 0;
  }
}

async function returnOutsideTry(): Promise<number> {
  return getPromise();
}

async function returnAlreadyAwaited(): Promise<number> {
  try {
    return await getPromise();
  } catch (err) {
    JSON.stringify(err);
    return 0;
  }
}

async function returnNonPromiseInsideTry(): Promise<number> {
  try {
    return 42;
  } catch (err) {
    JSON.stringify(err);
    return 0;
  }
}

async function returnInsideNestedFunction(): Promise<number> {
  try {
    const inner = (): Promise<number> => {
      return getPromise();
    };
    JSON.stringify(inner);
    return 0;
  } catch (err) {
    JSON.stringify(err);
    return 0;
  }
}

JSON.stringify(returnInsideTry);
JSON.stringify(returnInsideTryWithFinally);
JSON.stringify(returnInsideFinally);
JSON.stringify(returnInsideCatchWithOuterCatch);
JSON.stringify(returnInsideNestedTry);
JSON.stringify(returnOutsideTry);
JSON.stringify(returnAlreadyAwaited);
JSON.stringify(returnNonPromiseInsideTry);
JSON.stringify(returnInsideNestedFunction);
