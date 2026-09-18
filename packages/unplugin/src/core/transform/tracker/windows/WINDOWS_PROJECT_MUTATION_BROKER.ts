import type { WindowsProjectMutationBroker } from "./WindowsProjectMutationBroker";

/**
 * The one live Windows watch broker of this process, if any.
 *
 * A holder rather than a module-level binding, so every function that starts,
 * reuses, or retires the broker reads and replaces the same slot. The broker is
 * shared by every tracker of every generation in the process and retired when
 * its last registration closes or when the child exits.
 */
export const WINDOWS_PROJECT_MUTATION_BROKER: {
  current: WindowsProjectMutationBroker | undefined;
} = { current: undefined };
