# Actors, Authentication, and Account Authority

## REQ-AUTH-PROVISION Account Provisioning and Login

The product has one credentialed actor: a user who enters through an email-and-password account and then works inside a private profile and Todo collection. Open registration creates that account and profile before authenticated work begins. Returning users enter through login, which proves control of an existing account without creating new business information.

Registration and login share the same canonical email identity but have different effects and refusals. Registration resolves duplicate identity while creating the initial profile; login creates only a new authenticated session and gives invalid attempts no clue about whether an email is registered.

### REQ-AUTH-PROVISION-1 Register a Private Account

Anyone may register an account by providing an email address, password, and initial display name. The email and password must satisfy the credential rules in REQ-RULE-CREDENTIAL, and the display name must satisfy REQ-RULE-PROFILE.

A successful registration creates one active account, exactly one private profile carrying the supplied display name, and an empty Todo collection owned by that account. Successful registration also signs the new user in immediately, so the account's private capabilities are available without a separate login step.

If the canonical form of the email already belongs to an account, registration is refused. Invalid credentials or an invalid display name are also refused. A refused attempt creates no account, profile, Todo collection, or authenticated session.

### REQ-AUTH-PROVISION-2 Log In with Email and Password

A registered user may log in by submitting their email address and password. When both values authenticate the account, the product creates a new authenticated session that can access only that account's profile, todos, histories, and trash.

Login does not require profile or Todo input, and it does not replace other valid sessions for the same account. This allows the user to remain signed in on more than one device until a session is explicitly ended or invalidated by an account-security action.

If the email does not identify an account or the password is incorrect, login creates no session and returns the same invalid-credentials outcome. The outcome does not reveal which credential failed or whether the submitted email is registered.

## REQ-AUTH-SESSION Session Continuity and Logout

Once authenticated, a user can continue private Todo work through the same valid session without presenting the password for every interaction. The session always retains the same account identity and owner-scoped authority; continuation does not change profile or Todo information.

The product permits several valid sessions for one account so the user can stay signed in on more than one device. It therefore separates leaving the current device from ending access everywhere. Credential replacement and permanent account deletion also end session continuity through their own account-management effects.

### REQ-AUTH-SESSION-1 Continue an Authenticated Session

A user may renew authenticated continuity for the same account by presenting a valid session. Continuation does not require the account password again and cannot switch the session to another user's identity or expand its owner-scoped authority.

Continuation changes no profile, Todo, trash, or history information. It remains available while the session is valid under the account's current security state.

A missing, unknown, logged-out, or invalidated session cannot be continued. In particular, a session ended by current-session logout, all-session logout, password change, password recovery, or account deletion restores no authenticated authority.

### REQ-AUTH-SESSION-2 Log Out the Current Session

An authenticated user may log out the session they are currently using. The product immediately ends that session's authority, and the ended session cannot be continued or reused for another private operation.

Other valid sessions for the same account remain authenticated. Current-session logout changes no display name, credentials, Todo content, completion state, trash placement, or edit history.

### REQ-AUTH-SESSION-3 Log Out All Sessions

An authenticated user may end every session belonging to their account as one security action. This includes the session used to request the action and every other valid session for the same account.

Afterward, none of those sessions can continue or authorize a private operation; a new successful login is required for future access. Sessions belonging to other accounts are unaffected, and no profile, Todo, trash, or history information changes.

## REQ-AUTH-MANAGE Account Management

Account management gives the user three distinct security outcomes: changing a known password, recovering when the current password is unavailable, and permanently closing the account. Password change proves authority with the existing secret; recovery proves control of the registered email identity instead. Both replace the credential and end older authenticated access.

Account deletion is different from credential maintenance. It is a terminal, irreversible action that ends all authority and removes the profile, every active Todo, every Todo currently recoverable in trash, and every associated edit history entry. Nothing in that deleted account has a reactivation path.

### REQ-AUTH-MANAGE-1 Change the Account Password

An authenticated user may replace their password by supplying the correct current password and an accepted new password. The new password must satisfy REQ-RULE-CREDENTIAL and must differ from the current password.

On success, future login accepts the new password and rejects the old one. Every session issued before the change, including the session used to request it, ends immediately; the user must log in again with the new password.

An incorrect current password, a reused current password, or a new password outside the accepted rule is refused. A refused change leaves both the credential and every existing session unchanged.

### REQ-AUTH-MANAGE-2 Recover a Forgotten Password

A user who cannot provide the current password may recover the account by proving control of its registered email identity. Recovery then permits an accepted replacement password without requiring the old password.

The recovery journey does not disclose whether a submitted email belongs to an account before control is proven. The replacement password must satisfy REQ-RULE-CREDENTIAL.

Successful recovery makes the replacement password the only password accepted for future login and ends every session previously issued for the account. If email-identity control is not proven or the replacement password is invalid, no credential or session state changes.

### REQ-AUTH-MANAGE-3 Permanently Delete the Account

An authenticated user may permanently delete their own account after confirming authority with the correct current password. A wrong password refuses the action and leaves the account, its sessions, and all owned information unchanged.

Successful deletion removes the account and profile; every active todo; every todo already in trash; every edit history entry owned through those todos; and every session belonging to the account. These removals form one terminal outcome, so no part of the account remains usable after another part has been removed.

All account sessions lose authority immediately, and the deleted email and password no longer log in. The deleted account, profile, todos, and histories have no restoration or reactivation path.

## REQ-AUTH-BOUNDARY Private Account Authority

All account management, profile, Todo, history, and trash capabilities operate inside one authenticated account boundary. Registration, login, and the non-disclosing entry to forgotten-password recovery are the only account journeys that begin without an existing valid session.

Authentication identifies the current account; ownership then determines which private information that account may reach. The product has no global user grades, shared membership scopes, or transfer path that would grant one account authority over another. Once logout, credential replacement, or account deletion ends authority, the affected session can no longer continue or invoke a private operation.

### REQ-AUTH-BOUNDARY-1 Require Authentication for Private Capabilities

A valid user session is required to manage an account, view or edit its profile, work with active todos, inspect edit history, or use trash. The session identifies exactly one current account for every subsequent ownership decision.

Registration, login, and the non-disclosing start of password recovery remain available without an authenticated session. These entry journeys do not provide private account information until their own proof succeeds.

An absent, unknown, logged-out, or invalidated session has no private authority. A request made without valid authentication returns no protected information and changes no profile, Todo, history, trash, credential, or account state.

### REQ-AUTH-BOUNDARY-2 Limit Authority to Owned Private Information

An authenticated user may inspect and change only their own profile and todos, including each owned todo's trash state and edit history. Authentication grants no global administrative grade, shared workspace role, or authority over another account.

A todo retains the same owner through editing, completion changes, soft deletion, and restoration. Its history derives authority from that same ownership and cannot be reached independently as another user's information.

The product offers no operation to transfer, share, or assign a profile or todo to another account. An ownership mismatch is refused without returning the private target or changing any account's information.
