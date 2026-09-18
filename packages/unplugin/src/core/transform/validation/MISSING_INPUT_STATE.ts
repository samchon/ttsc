/**
 * The recorded state of an input the generation read nothing from: absent, or
 * present but unreadable. It is deliberately not a hash, so no signature may
 * stand in for it: the metadata of an unreadable path holds still while the
 * bytes behind it appear.
 *
 * A directory is not this state. It records the hash of a marker instead, which
 * a signature may stand for, because the mode both halves of the signature
 * carry cannot change without the path ceasing to be that directory.
 */
export const MISSING_INPUT_STATE = "missing";
