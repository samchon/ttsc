const o: any = {};
// expect: noIterator error
JSON.stringify(o.__iterator__);
