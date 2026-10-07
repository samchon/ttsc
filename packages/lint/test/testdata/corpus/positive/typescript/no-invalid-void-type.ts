// expect: typescript/no-invalid-void-type error
type Result = string | void;
JSON.stringify({} as Result);
