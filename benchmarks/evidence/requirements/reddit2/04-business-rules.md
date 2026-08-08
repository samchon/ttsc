# Business Rules

This document owns validation, uniqueness, eligibility, ranking, calculation, conflict, and refusal policies. It does not redefine domain information or repeat the commands whose inputs these rules qualify.

## REQ-RULE-IDENTITY Account Identity Rules

Email identifies one private sign-in identity and username identifies one public account. Both are compared without letter-case distinctions and remain reserved after deletion. Registration also applies one concrete allowed-form boundary so people receive correctable field-specific refusals.

### REQ-RULE-IDENTITY-001 Enforce Case-Insensitive Email and Username Uniqueness

No two existing or deleted accounts may reserve case-equivalent email addresses or usernames. Email uniqueness ensures one login identity; username uniqueness ensures one public profile and author identity.

Comparison ignores letter case, while the selected username casing remains visible publicly. A conflict identifies email, username, or both and creates no account.

### REQ-RULE-IDENTITY-002 Require Complete Registration Credentials

Registration accepts only:

- a nonblank, well-formed email address;
- a username of 3 through 30 letters, digits, or underscores; and
- a password of 8 through 128 characters.

Leading and trailing whitespace is removed from email and username before validation and comparison. Username display casing is preserved. Password characters are neither trimmed nor transformed. Every invalid field is identified for correction.

### REQ-RULE-IDENTITY-003 Reserve Deleted Account Identifiers

Permanent deletion keeps the former normalized email and username unavailable. That reservation permits no login, recovery, profile view, or reactivation, but prevents impersonation of the deleted public identity.

A new account may be created only with a different available email and username. Attempting either reserved value is refused as an identity conflict.

## REQ-RULE-PROFILE Profile Validation Rules

Profile editing validates the three public fields as one atomic change. Display name remains visible text, bio may be empty, and avatar may be absent or a valid upload. Account identity, credentials, karma, and authorship cannot be rewritten through this surface.

### REQ-RULE-PROFILE-001 Validate Profile Field Changes

A supplied display name must contain visible non-whitespace text. Bio may contain text or be empty. Avatar may be a valid image under REQ-RULE-MEDIA or may be explicitly removed.

Username, email, password, account status, karma, and authored relationships are not profile-edit fields. A valid partial edit preserves omitted values. If any supplied field is invalid or unsupported, the entire edit is refused and the current profile remains unchanged.

## REQ-RULE-COMMUNITY Community Validation and Discovery Rules

Community creation needs a stable, human-readable public name plus descriptive text and icon. Name conflicts ignore letter case, and archived names remain reserved. Search uses the same normalized name meaning, matches substrings only in that field, and returns a deterministic public order.

### REQ-RULE-COMMUNITY-001 Validate Community Creation Fields and Unique Name

A community name contains 3 through 50 letters, digits, hyphens, or underscores. Leading and trailing whitespace is removed before validation and case-insensitive uniqueness comparison; accepted public casing is preserved. Active and archived communities both reserve their names.

Description must contain visible non-whitespace text and may contain at most 1,000 characters. A valid icon under REQ-RULE-MEDIA is required. Any missing, invalid, or conflicting field refuses the whole creation.

### REQ-RULE-COMMUNITY-002 Match and Order Community Name Search

The trimmed query matches a community when its name contains that text without regard to letter case. Description, posts, and comments do not participate.

An empty query matches the complete active-and-archived catalog. Results are ordered by normalized community name and then stable community identity for an exact tie. No matches yields an empty result.

## REQ-RULE-POST Post Content Rules

Post validation preserves the required title and exact text, link, or image distinction. Each type has a concrete valid payload, and edits remain within the originally selected type. Multi-field creation and editing are atomic: one invalid supplied value leaves no partial post change.

### REQ-RULE-POST-001 Validate Required Title and Exact Post Payload

A title contains 1 through 300 visible characters after leading and trailing whitespace is removed. The post then contains exactly one matching payload:

- text post: 1 through 40,000 characters and not all whitespace;
- link post: one URL and no text or image payload; or
- image post: one uploaded image and no text or URL payload.

A blank or oversized title or text, absent payload, extra payload, or type-payload mismatch refuses creation or editing.

### REQ-RULE-POST-002 Validate Link and Image Payloads

A link URL is absolute, uses HTTP or HTTPS, contains a parseable host, and has at most 2,048 characters. Its host supplies the feed-card domain. Relative URLs and other schemes are refused.

An image post owns one image accepted under REQ-RULE-MEDIA and its thumbnail. Failed link or image validation creates no post and leaves an edited post entirely unchanged.

### REQ-RULE-POST-003 Restrict Post Editing to Title and Same-Type Content

The author may replace the title, the current type's payload, or both; omitted editable values remain unchanged. Text remains text, link remains link, and image remains image.

Author, community, original creation time, and every field outside title and current payload are immutable through editing. Any attempted type, identity, community, or unsupported-field change is refused. All supplied values validate together, so one invalid value preserves the complete current post.

## REQ-RULE-PARTICIPATION Community Participation Rules

Post creation needs an active subscription. Commenting needs authentication but not subscription. An active community ban overrides both creation paths without hiding public content or blocking separately permitted actions. These predicates use current state in the one community where the action occurs.

### REQ-RULE-PARTICIPATION-001 Require Subscription for Post Creation

Post creation checks for an active subscription to the target community at that moment. An ended subscription, or owner or moderator authority without subscriber status, does not satisfy the requirement. The creator of a new community already qualifies through creator subscription.

Editing or deleting an existing authored post does not require subscription. Only new post creation is refused when the relationship is absent.

### REQ-RULE-PARTICIPATION-002 Allow Non-Subscribers to Comment

An authenticated user without a subscription may create a top-level comment or reply at any depth on available content in an active community, provided no active ban applies.

Commenting creates no subscription or home-feed inclusion. It does not permit post creation without membership. Absence of subscription is intentionally not a comment refusal.

### REQ-RULE-PARTICIPATION-003 Refuse Banned-User Posting and Commenting

While a community ban is active, the platform refuses new posts, top-level comments, and replies in that community. No content, count, profile, or feed state changes.

The same user may participate in another community where no ban applies and may edit or delete their existing content in an active community. Unbanning restores comment eligibility and subscription-dependent post eligibility.

### REQ-RULE-PARTICIPATION-004 Preserve Banned-User Viewing Access

A banned user may still browse the community catalog and feed, open posts and comment threads, view profiles and vote scores, and use the same public views while logged out. The community remains visible in name search and browsing.

Voting and reporting remain available on active-community content because the ban forbids only posts and comments. Private moderation lists remain unavailable unless the user independently holds current moderator authority.

## REQ-RULE-FEED Feed Ranking and Pagination Rules

All three feed scopes use the same four orders. New follows original creation time; Top follows score within a named rolling age window; Hot balances positive score against age decay; Controversial balances vote volume against proximity to zero. Every order has deterministic ties and remains stable within one paginated traversal.

### REQ-RULE-FEED-001 Order Feeds by New

New orders original creation time from newest to oldest. An exact time tie uses stable post identity descending.

Editing does not move a post because original creation time is unchanged. Deletion removes the post without changing surviving items' relative New order. Home, Popular, and Community use the same rule after applying their own scope.

### REQ-RULE-FEED-002 Order Feeds by Top and Selected Time Range

Top first selects posts by original creation time:

| Range | Included age at the traversal snapshot |
| --- | --- |
| Today | Prior 24 hours |
| This week | Prior 7 days |
| This month | Prior 30 days |
| This year | Prior 365 days |
| All time | No age cutoff |

A post exactly at the cutoff is included. Within the selected population, vote score orders highest first, then creation time newest first, then stable post identity. A fresh traversal reflects current scores.

### REQ-RULE-FEED-003 Order Feeds by Hot

Hot ranks highest to lowest by:

`log10(max(vote score, 1)) − age in hours / 12.5`

Age runs from original creation time to the traversal snapshot. A score of zero or below receives no positive score boost and continues to decay. Exact rank ties use newer creation time and then stable post identity. A fresh traversal reflects current score and age.

### REQ-RULE-FEED-004 Order Feeds by Controversial

Controversial ranks highest to lowest by:

`(active upvotes + active downvotes) / (absolute vote score + 1)`

Balanced positive and negative voting therefore ranks above one-sided voting with the same total. Exact ratio ties use greater total votes, then newer creation time, then stable post identity. A post with no votes has value zero.

### REQ-RULE-FEED-005 Apply Deterministic Pagination Boundaries

A feed continuation binds the ranked values and tie fields to feed scope, sort, Top range, and traversal snapshot. Equal-ranked posts are neither duplicated nor skipped.

Votes and new posts after the snapshot appear only in a fresh traversal. A deleted post may disappear from a later page without changing surviving snapshot order. Page size and invalid continuation follow REQ-RULE-PAGINATION and REQ-NFR-CONTINUITY.

## REQ-RULE-VOTE Voting and Aggregate Rules

Post and comment voting share one state router and the same signed calculations. One user-target pair has at most one active vote. Score equals current upvotes minus downvotes, and author karma receives the same transition delta. Removing content or an account reverses contributions that no longer have a valid target or participant.

### REQ-RULE-VOTE-001 Enforce One Active Vote per User and Target

For an authenticated user and available post or comment in an active community:

- no vote plus upvote or downvote creates that value;
- the opposite active value changes direction;
- the same active value makes no change; and
- removal returns an active value to no vote.

Only the voter controls change or removal. No route creates two active votes. Logged-out users, unavailable content, and archived-community targets cannot change vote state.

### REQ-RULE-VOTE-002 Calculate Content Vote Score

Post and comment score equals active upvotes minus active downvotes. Upvote contributes +1, downvote −1, and no vote zero.

Changing direction replaces the prior sign; removal contributes nothing. The final total may be positive, zero, or negative.

### REQ-RULE-VOTE-003 Adjust Author Karma for Vote Transitions

Post votes adjust the post author and comment votes adjust the comment author:

- creation applies +1 for upvote or −1 for downvote;
- direction change applies +2 or −2; and
- removal applies the inverse of the prior active value.

The voter receives no other karma effect for acting. Score and karma change as one product outcome, and karma may pass below zero.

### REQ-RULE-VOTE-004 Reverse Vote Aggregates When Content Is Deleted

Deleting a post or comment removes every active vote on that target and reverses each remaining author-karma contribution. Deleted target score is no longer presented.

Post deletion applies the same rule transitively to all removed comments. Account deletion separately removes the deleted user's votes from surviving targets. The completed deletion never exposes a target/karma mismatch.

## REQ-RULE-COMMENT Comment Tree and Sorting Rules

Every reply belongs to one acyclic same-post tree, with no maximum depth. Best, New, and Controversial order each sibling set independently. Their exact ties keep pagination deterministic. A deleted marker derives its position from the strongest surviving direct reply under the selected order.

### REQ-RULE-COMMENT-001 Validate Same-Post Acyclic Reply Relationships

A top-level comment has no parent. A reply selects exactly one available immediate parent on the same post.

The parent cannot be the reply itself, its descendant, a comment on another post, or a deleted marker. Parent identity is not editable. An invalid relationship creates no comment or count change.

### REQ-RULE-COMMENT-002 Allow Unlimited Reply Depth

Depth alone never refuses a reply. A valid reply at any finite depth is accepted when the actor, text, post, parent, community, and ban conditions are satisfied.

Every accepted reply remains reachable from its top-level ancestor. Sorting applies independently to sibling sets at every depth.

### REQ-RULE-COMMENT-003 Order Comments by Best

Best orders vote score highest first within each sibling set. An equal score uses original creation time oldest first, then stable comment identity.

Older time preserves an established discussion position. A deleted marker takes the Best position of its highest-ranked surviving direct reply. A fresh traversal reflects current scores.

### REQ-RULE-COMMENT-004 Order Comments by New

New orders creation time newest first within each sibling set and uses stable comment identity descending for an exact time tie. Editing does not affect position.

A deleted marker takes the New position of its newest surviving direct reply.

### REQ-RULE-COMMENT-005 Order Comments by Controversial

Controversial orders highest to lowest by:

`(active upvotes + active downvotes) / (absolute vote score + 1)`

An exact ratio tie uses greater total votes, then newer creation time, then stable comment identity. No votes yields zero. A deleted marker takes the Controversial position of its highest-ranked surviving direct reply.

## REQ-RULE-REPORT Reporting Rules

Reports require one available content target and a bounded nonblank reason. One reporter cannot duplicate unresolved work on the same target. Only current community moderators see or decide pending reports, and each report accepts only one terminal outcome.

### REQ-RULE-REPORT-001 Require a Valid Report Target and Reason

A report targets exactly one available post or comment in an active community. Its textual reason contains 1 through 2,000 non-whitespace characters after leading and trailing whitespace is removed.

The reporter need not subscribe and may be banned or be the target author. A blank or oversized reason, invalid target kind, unavailable target, or archived community creates no report.

### REQ-RULE-REPORT-002 Refuse Duplicate Unresolved Reports

When one reporter-target pair already has an unresolved report, a second submission is refused and leaves the existing report and content unchanged. Changing the reason does not bypass the conflict.

Another user may report the same target. The original reporter may submit again after resolution if the content remains available.

### REQ-RULE-REPORT-003 Restrict Report Queue Visibility and Resolution

Each queue view, approval, and dismissal requires current owner or moderator authority in the target content's exact community. Authority elsewhere grants nothing, and losing the scoped role ends access immediately.

Reporter status, target authorship, subscription, and ban state do not independently grant moderation access. Public profile and content views expose no report state or reason.

### REQ-RULE-REPORT-004 Refuse Repeat Report Resolution

Approval or dismissal applies only while the report is unresolved and its target remains available. An approved report cannot receive either decision again, and neither can a dismissed report.

A sibling report removed with deleted content cannot later be decided. Concurrent attempts produce one terminal outcome; each later attempt is refused without changing content, queue, or moderation history.

## REQ-RULE-MODERATION Moderation Authority Rules

Moderation authority is current, community-scoped, and inactive in archives. The owner-only revoke edge protects owner and peer roles from moderators. The current owner is also protected from a community ban so lower-order authority cannot disable the community's highest authority.

### REQ-RULE-MODERATION-001 Confine Moderation Actions to the Assigned Community

Deleting content, managing bans, viewing or deciding reports, and assigning or removing moderators require a current owner or moderator role in the exact target community. Authority in one community grants nothing in another.

Losing the role immediately ends these actions. Public viewing remains independent. Archived communities accept no moderation changes. A mismatched scope, expired role, or archive is refused.

### REQ-RULE-MODERATION-002 Protect Owner and Moderator Assignments From Moderator Removal

The owner is not a moderator-removal target for any caller. A moderator cannot remove their own role or a peer's role. Each such attempt preserves all scoped roles.

The current owner may remove another user's moderator role, but not the owner role. Moderator-initiated removal and protected targets are refused.

### REQ-RULE-MODERATION-003 Protect the Owner From Community Bans

The current owner cannot be banned in the owned community, whether the caller is a moderator or the owner targeting themselves. The refusal preserves owner access and all existing ban state.

Other moderators remain eligible ban targets. Ownership succession changes which user is protected, and the same user may be banned in a different community they do not own.

## REQ-RULE-MEDIA Uploaded Image Rules

Avatar, community-icon, and image-post uploads share one accepted media boundary. Accepted images remain tied to their owning public context. Image posts also receive a bounded aspect-preserving thumbnail while keeping the full image available.

### REQ-RULE-MEDIA-001 Validate Uploaded Image Format and Size

An upload must decode successfully as JPEG, PNG, or WebP and contain no more than 10 MiB. Its declared format and decoded content must agree.

Empty, corrupt, unsupported, mismatched, or oversized input is refused. A failed replacement leaves the current avatar, community icon, or post image unchanged.

### REQ-RULE-MEDIA-002 Present Uploaded Images and Post Thumbnails

An accepted image remains viewable with its owning profile, community, or post. An image-post thumbnail fits inside a 400-by-400-pixel box without cropping, stretching, or enlarging a smaller image. Opening the post keeps the full image available.

Avatars remain accompanied by username and display name, community icons by community name, and post images by post title. Replacing or deleting the owning image removes the obsolete public presentation.

## REQ-RULE-PAGINATION Shared Pagination Rules

Feeds, communities, subscriptions, profile authorship, ban lists, and report queues share one page-size and continuation contract. A traversal keeps its scope, filters, ordering, page size, and snapshot. Invalid continuation recovers through a clearly marked fresh first page rather than an ambiguous partial result.

### REQ-RULE-PAGINATION-001 Validate Requested Page Size

An omitted size selects 25 items. A supplied size is an integer from 1 through 100 and remains fixed for every continuation in that traversal. Zero, negative, fractional, or greater-than-100 values are refused.

The final page may contain fewer items. Feed, community, subscription, profile post/comment, ban, and report lists share this boundary. Top-level comment page size does not count the nested descendants included beneath those roots.

### REQ-RULE-PAGINATION-002 Validate Continuation Scope and Recover From Stale State

A continuation is valid only for the unchanged current user where relevant, community, list kind, filters, sort, time range, page size, and traversal snapshot that created it.

An unknown, stale, or mismatched continuation returns a fresh first page under the caller's current inputs and a visible reset indicator. The reset begins a new snapshot. A final or empty page has no next continuation.
