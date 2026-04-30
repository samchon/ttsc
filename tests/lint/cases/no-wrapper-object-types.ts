// expect: no-wrapper-object-types error
type Name = String;

JSON.stringify({} as Name);
