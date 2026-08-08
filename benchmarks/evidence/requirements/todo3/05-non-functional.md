# Non-Functional Requirements

## REQ-NFR-PRIVACY Private Data Isolation

An account's email identity, display name, active todos, trashed todos, and edit histories form one confidential product boundary. The same isolation applies to lists, individual views, changes, and recovery actions; no surface becomes a weaker path to another account's information.

The product has no public profile, sharing, transfer, or cross-account access capability. An ownership mismatch reveals no private target and changes no owner's information.

### REQ-NFR-PRIVACY-1 Isolate Every Account's Private Information

Each authenticated user can view and change only their own profile and Todo information. Active lists, trash lists, individual details, and full histories contain no information owned by another account.

A direct cross-owner attempt has the same unavailable outcome as an absent private target, so it reveals neither content nor existence. The attempt changes no profile, Todo, completion value, trash state, history, credential, or account.

No product capability makes an account's email, display name, active todos, trashed todos, or histories public, shared, transferable, or assignable to another user. This guarantee applies consistently to viewing, editing, completion, soft deletion, history inspection, restoration, permanent Todo deletion, and account deletion.

## REQ-NFR-INTEGRITY Change and Deletion Integrity

Users can rely on linked Todo effects becoming visible as complete outcomes. A content edit and its matching history entry agree; recoverable deletion moves the same task and history between active work and trash; and permanent deletion removes the complete selected ownership scope.

When one of these changes does not complete, the previously accepted Todo, history, profile, account, and authority state remains the visible truth. Recovery paths apply only to soft deletion; successful permanent deletion has no partial remainder or restoration path.

### REQ-NFR-INTEGRITY-1 Keep Todo Edits and History Consistent

After a successful content edit, the accepted Todo values and exactly one matching history entry become visible together. The entry's edit time and changed-to values describe that same accepted change.

An accepted Todo edit is never visible without its history entry, and no history entry is visible for Todo changes that were not accepted. A stale, invalid, state-ineligible, or unauthorized edit preserves the previously accepted Todo and history together.

### REQ-NFR-INTEGRITY-2 Preserve Recoverable Todo State

Soft deletion makes the same complete Todo and history unavailable in active work and available through trash and history surfaces. Restoration makes that same complete Todo and history unavailable in trash and available again through active and history surfaces.

Both transitions preserve content, dates, completion, ownership, creation information, and the full history as one recoverable set. If soft deletion or restoration does not complete, the entire set remains in its prior state and view.

### REQ-NFR-INTEGRITY-3 Complete Permanent Deletion as One Outcome

Permanent Todo deletion removes the trashed Todo and every attached history entry together. Permanent account deletion removes the account, profile, every active and trashed Todo, every attached history entry, and every account session together.

A completed deletion leaves no orphaned profile, Todo, history entry, or usable account session inside its selected scope, and that scope has no recovery path. If permanent deletion is refused or does not complete, the full preexisting scope remains available and authoritative.
