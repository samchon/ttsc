declare class EventEmitter { constructor(); }
// expect: unicorn/prefer-event-target error
const em = new EventEmitter();
void em;
