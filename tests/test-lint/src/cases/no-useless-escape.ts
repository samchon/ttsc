// expect: no-useless-escape error
const value = "ab\cdef";
JSON.stringify(value);
