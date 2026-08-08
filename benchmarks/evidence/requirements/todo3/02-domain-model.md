# Domain Model

## REQ-DOM-PROFILE Profile Meaning and Relationship

The user profile is the account holder's private display identity inside the Todo product. It is not a login identity or a public directory entry: credentials establish the account, while the profile supplies an editable display name shown within that account's private experience. Changing that name leaves credentials and Todo ownership intact.

Every account and profile form one inseparable ownership pair. The profile begins with registration, remains attached to the same account, and ends with permanent account deletion. Its definition and its one-to-one relationship are stated separately because display-name meaning does not change the ownership boundary.

### REQ-DOM-PROFILE-1 Define the User Profile

A user profile carries one current display name for the account holder. The display name is distinct from the email used to log in and does not grant authority, identify a shared membership, or expose the account to other users.

Changing the display name changes only the private display identity. It does not change the email credential, password, account identity, Todo ownership, or history ownership.

### REQ-DOM-PROFILE-2 Bind One Private Profile to Each Account

Every user account owns exactly one profile, and every profile belongs to exactly one account. Registration creates the profile with its account; permanent account deletion removes the profile with that account.

The relationship cannot be transferred, shared, or detached. Another account cannot own, view, or edit the profile, and no public profile collection makes it discoverable.

## REQ-DOM-TODO Todo Meaning and Ownership

A todo is one private task belonging to an account. It combines a required title with an independently optional description, start date, and due date, plus product-observed creation and completion facts. Whether the task is active or in trash is a separate lifecycle dimension and does not create a different task.

The todo remains inside the same account boundary for its entire recoverable lifetime. That ownership also contains its edit history and determines the complete data removed when the account is permanently deleted.

### REQ-DOM-TODO-1 Define Todo Information

Every todo has the following information:

| Attribute | Meaning |
| --- | --- |
| Title | The required short name of the task. |
| Description | Optional details; it may be empty. |
| Start date | An optional calendar date for when work is intended to begin; it may be empty. |
| Due date | An optional calendar date for when the task is intended to be due; it may be empty. |
| Completion status | Exactly one of `incomplete` or `complete`. |
| Creation date | When the todo was first created. |

Description, start date, and due date are independent optional values, so leaving one empty does not require the others to be empty. Start and due values are calendar dates without a time-of-day component. The creation date remains the original creation fact when content, completion, or trash state changes.

The full description is part of the todo's details. The normal and trash lists use the smaller summary projection defined by their browsing requirements rather than replacing or truncating the stored task meaning.

### REQ-DOM-TODO-2 Bind Each Todo to One Account

Every todo belongs to exactly one user account: the authenticated account that created it. Ownership is permanent while the todo exists and does not change through editing, completion, soft deletion, or restoration.

A todo cannot be transferred, shared, reassigned, or detached. Every edit history entry remains inside the same account boundary through its owning todo.

Permanent account deletion removes every todo owned by the account, whether active or in trash and whether incomplete or complete, together with all history owned through those todos.

## REQ-DOM-TODO-LIFE Todo Lifecycle

Todo lifecycle uses two independent dimensions. Completion answers whether the task is marked done; availability answers whether the task is active in normal work or retained in trash. A complete todo can be active or trashed, just as an incomplete todo can.

Creation begins with an incomplete, active todo. Soft deletion and restoration change only availability and preserve the same task for recovery. Permanent deletion is terminal and removes both the todo and its edit history.

### REQ-DOM-TODO-LIFE-1 Define Completion States

A todo always has exactly one of two completion values while it exists:

- `incomplete` means the task is not marked complete.
- `complete` means the task is marked complete.

Every new todo begins `incomplete`. The two values are mutually exclusive, and content edits, soft deletion, and restoration preserve the current value. Completion does not determine whether the todo is active or in trash.

### REQ-DOM-TODO-LIFE-2 Define Active and Trashed Availability

Every existing todo has exactly one availability value:

- `active` makes the todo part of the owner's normal list and eligible for normal detail and change operations.
- `trashed` removes the todo from the normal list and makes it available only through the owner's trash and history surfaces.

New and restored todos are active; soft-deleted todos are trashed. Availability is independent from completion. A permanently deleted todo has no availability state because the todo no longer exists.

### REQ-DOM-TODO-LIFE-3 Move an Active Todo to Trash

When the owner soft-deletes an active todo, its availability changes from `active` to `trashed`. It records the date and time of that most recent move into trash, disappears from the normal list, and becomes discoverable in the owner's trash.

The transition preserves the todo's title, description, start date, due date, creation date, completion status, owner, and every existing edit history entry. It does not create a content-edit history entry because no editable content field changes.

A todo already in trash cannot repeat the active-to-trashed transition. A permanently deleted todo no longer exists to make that transition.

### REQ-DOM-TODO-LIFE-4 Restore a Trashed Todo

When the owner restores a trashed todo, its availability changes from `trashed` to `active`. The same todo leaves trash and reappears in the normal list rather than being replaced by a new task.

Restoration preserves the title, description, start date, due date, creation date, completion status, owner, and every edit history entry. It creates no content-edit history entry because no editable content field changes.

An active todo cannot perform the trashed-to-active transition. A permanently deleted todo cannot be restored.

### REQ-DOM-TODO-LIFE-5 Permanently Delete a Trashed Todo

When the owner permanently deletes a trashed todo, the todo and every edit history entry associated with it cease to exist. The task appears in neither the active list nor trash, and no history for it remains viewable.

Its title, description, start date, due date, completion status, creation date, and ownership relationship are no longer available. This terminal outcome cannot be restored, reversed, or repeated as another lifecycle transition.

Permanent deletion through the trash lifecycle is unavailable for an active todo. An already absent todo has no remaining lifecycle command.

## REQ-DOM-HISTORY Edit History Meaning and Relationship

Todo edit history is the private chronology of changes to editable task content. It does not stand for completion or trash events. Each successful content edit contributes one immutable entry that records when the edit occurred and only the new values involved in that edit. Clearing an optional field is recorded explicitly rather than being confused with that field not changing.

History is not an independent account resource. Every entry belongs to one todo, derives the same owner, follows that todo through trash and restoration, and ends when the todo or its account is permanently deleted.

### REQ-DOM-HISTORY-1 Define an Edit History Entry

Each edit history entry has an edit time and may carry any of these changed-to values:

| Changed-to value | Present when |
| --- | --- |
| Title | The edit changed the todo's title. |
| Description | The edit changed the todo's description. |
| Start date | The edit changed the todo's start date. |
| Due date | The edit changed the todo's due date. |

One entry can carry several changed-to values when one edit changes several fields. A changed-to value is absent when that field did not participate in the edit.

Clearing an optional description, start date, or due date is recorded explicitly as a change to empty; it is distinguishable from the changed-to value being absent because the field did not change. Completion changes, soft deletion, and restoration are not members of this content-edit catalog.

### REQ-DOM-HISTORY-2 Bind History to Its Todo Lifecycle

Every edit history entry belongs to exactly one todo and to the same account owner through that todo. An entry cannot be transferred, shared, or detached independently.

Soft deletion preserves the todo's full history, and restoration returns the same todo with the same history. Permanent deletion of the todo removes every attached entry. Permanent deletion of an account removes every history entry attached to every todo owned by that account.
