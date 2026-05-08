const o: any = {};
// expect: no-proto error
JSON.stringify(o.__proto__);
