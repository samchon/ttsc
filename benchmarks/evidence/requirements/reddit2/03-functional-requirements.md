# Functional Requirements

This document defines the commands and viewing journeys available to public visitors, authenticated users, community subscribers, owners, and moderators. Domain definitions and validation policies remain in their canonical documents and are referenced where an operation depends on them.

## REQ-FUNC-PROFILE Profile Operations

Only the owning account may edit a profile. Viewing uses the unique username and is public to logged-in and logged-out visitors. The public result combines descriptive attributes, karma, and complete currently available authorship while excluding account and moderation-private information.

### REQ-FUNC-PROFILE-001 Edit the Current User's Profile

An authenticated user may change their own display name, bio, and avatar. One request may supply one, several, or all three fields; omitted fields retain their current values. Bio may be cleared and an existing avatar may be removed.

Valid changes become public immediately. A profile edit cannot change username, email, password, karma, or authored-content lists. Editing another user's profile, a blank display name, or an invalid avatar is refused under REQ-RULE-PROFILE and REQ-RULE-MEDIA.

### REQ-FUNC-PROFILE-002 View a User's Public Profile

Any logged-in or logged-out visitor may open an available profile by unique username, including their own. The result shows display name, bio, avatar, total karma, every available authored post, and every available authored comment.

The post and comment lists are paginated independently so each can cover all available authorship. Email, credentials, sessions, subscriptions, bans, votes cast, reports, and moderation history are excluded. An unknown or permanently deleted username produces a not-found result.

## REQ-FUNC-COMMUNITY Community Operations

Any authenticated user may create a community and becomes its scoped owner. Community discovery is public: complete browsing and name search return paginated descriptive results with current subscriber counts. Archived communities remain discoverable and visibly identified.

### REQ-FUNC-COMMUNITY-001 Create a Community

An authenticated user may create an active community from a valid unique name, description, and icon. The submitted values become its public attributes.

Successful creation makes the user owner and subscriber, starts subscriber count at one, and permits immediate posting and moderation. A conflicting name, missing required field, or invalid icon is refused under REQ-RULE-COMMUNITY and REQ-RULE-MEDIA, creating no community or scoped role.

### REQ-FUNC-COMMUNITY-002 Browse All Communities

Any logged-in or logged-out visitor may traverse the complete public community catalog through pages, without subscribing. Active and archived communities are ordered by normalized name.

Each result shows name, description, icon, status, and current subscriber count. Archived entries are visibly identified and remain available for public reading.

### REQ-FUNC-COMMUNITY-003 Search Communities by Name

Any visitor may search the public catalog by community name. Matching follows REQ-RULE-COMMUNITY and does not search description or content.

Results are paginated in normalized-name order and show name, description, icon, status, and subscriber count. A valid query with no matches yields an empty page. An empty query is equivalent to browsing all communities.

## REQ-FUNC-SUBSCRIPTION Subscription Operations

An authenticated user controls their own relationship to an active community. Subscription adds subscriber-count, home-feed, and posting-membership effects; unsubscription removes them without deleting past participation or scoped authority. The user can inspect all current subscriptions in one private paginated list.

### REQ-FUNC-SUBSCRIPTION-001 Subscribe to a Community

An authenticated user may subscribe themselves to any active community. Success activates the relationship, increments subscriber count once, includes the community in the home feed, and satisfies the membership part of post eligibility.

Selecting a community already subscribed to is a no-change success and never increments the count twice. A user may subscribe while banned, but the ban still blocks posts and comments. An unknown or archived community is refused.

### REQ-FUNC-SUBSCRIPTION-002 Unsubscribe From a Community

An authenticated user may end their own subscription. Subscriber count decreases, the community leaves the home feed, and subscription-based post eligibility ends. Prior participation and owner or moderator authority remain as defined by the Subscription lifecycle.

An absent subscription is a no-change success. A residual subscriber may unsubscribe from an archived community. An unknown community is refused, and no user may unsubscribe another account.

### REQ-FUNC-SUBSCRIPTION-003 List the Current User's Subscriptions

An authenticated user may traverse every active subscription belonging to their own account. Results are paginated in normalized community-name order.

Each item shows community name, description, icon, active or archived status, and subscriber count. Archived communities remain listed until the user unsubscribes. Another user's list is unavailable, and an account with no subscriptions receives an empty page.

## REQ-FUNC-POST Post Operations

Post creation requires an active subscription and no community ban. Full post viewing is public. Authors may edit or delete their own posts, while a community owner or moderator has a separate delete-any action. Every deletion follows the shared Post lifecycle and its dependent participation effects.

### REQ-FUNC-POST-001 Create a Post

An authenticated user may publish in an active community when they have an active subscription and no active ban there. The user supplies a valid required title and exactly one text, link, or image payload under REQ-RULE-POST.

Success creates the post with the user as author, the selected community, and the current creation time. Vote score and comment count start at zero; creation does not cast an automatic author vote. The post becomes available in direct view, its community feed, eligible popular ordering, the author's profile, subscribed users' home feeds, and ranking results.

An invalid title, type, payload, link, image, community state, membership, or ban condition creates no post.

### REQ-FUNC-POST-002 View a Single Post

Any logged-in or logged-out visitor may inspect an available post. The result shows title, full text, full URL, or full image payload, author username, community name, vote score, comment count, and original creation time.

Non-subscribers and banned users receive the same public content. An unknown or deleted post produces a not-found result.

### REQ-FUNC-POST-003 Edit an Authored Post

An authenticated author may change the title, the current type's payload, or both on an active post; an omitted editable value remains unchanged. The post keeps its author, community, type, creation time, votes, comments, and reports.

A banned or unsubscribed author may still correct an existing post. A non-author, including a moderator acting only through moderation authority, cannot edit it. The action also refuses a deleted post, archived community, invalid value, or attempted author, community, or type change.

### REQ-FUNC-POST-004 Delete an Authored Post

An authenticated author may permanently delete their active post, including after unsubscribing or being banned. Self-deletion requires no moderator approval or reason.

Deletion applies REQ-DOM-POST-LIFE-002 and cannot be undone. Targeting another user's available post is refused; an unknown or already deleted post produces not found and no additional change.

### REQ-FUNC-POST-005 Delete a Community Post as Moderator

A current community owner or moderator may permanently delete any active post in that community, regardless of author, score, age, or report state. A moderator cannot act on a post in another community.

Deletion applies REQ-DOM-POST-LIFE-002. Private moderation history identifies the acting moderator and time without retaining removed content. The author's account, other posts, subscription, and roles remain unchanged. Missing authority or unavailable content is refused.

## REQ-FUNC-FEED Post Feed Journeys

Home, popular, and community feeds differ in audience and post scope but share sorting, pagination, and post-card presentation. Home uses the current user's subscriptions; popular spans the platform; community narrows to one community. Hot, New, Top, and Controversial are available in all three, and Top also uses a named time range.

### REQ-FUNC-FEED-001 View the Authenticated Home Feed

A logged-in user may browse available posts only from communities they currently subscribe to. A popular post from an unsubscribed community is excluded.

Posts from an archived community remain eligible while the user has a residual active subscription. Sorting, Top range, and shared pagination apply. No matching posts yields an empty page. Logged-out visitors are refused.

### REQ-FUNC-FEED-002 View the Public Popular Feed

Any logged-in or logged-out visitor may browse available posts from all communities without a subscription or single-community restriction. Posts from active and archived communities are eligible.

The selected sorting, Top range, and shared pagination apply. When the platform has no available posts, the feed returns an empty page.

### REQ-FUNC-FEED-003 View a Public Community Feed

Any visitor may browse available posts belonging to one selected community. Logged-in and logged-out visitors receive the same public content, and an archived community's feed remains readable.

Sorting, Top range, and shared pagination apply. An unknown community is not found; a known community with no posts returns an empty page.

### REQ-FUNC-FEED-004 Choose Feed Sorting and Top Time Range

A reader may select Hot, New, Top, or Controversial on any feed. Hot is the default when no sort is supplied.

Top accepts today, this week, this month, this year, or all time and defaults to all time. A Top range cannot accompany New, Hot, or Controversial. An unknown sort, unknown range, or incompatible combination is refused. Changing sort or range begins again at the first page under REQ-RULE-FEED.

### REQ-FUNC-FEED-005 Navigate Paginated Feed Results

Every feed returns bounded pages under REQ-RULE-PAGINATION and REQ-NFR-CONTINUITY. Its continuation preserves feed kind, current user for Home, selected community, sort, Top range, and the traversal snapshot.

Each page respects the accepted size. Changing any scoped input invalidates the old continuation, and the final page indicates that no next page remains.

### REQ-FUNC-FEED-006 Display Feed Post Cards

Every feed card presents title, author username, community name, vote score, comment count, and relative time anchored to original creation. Opening it leads to the complete single-post view.

The type-specific preview is the first 200 text characters, an image thumbnail, or the link URL's domain. Relative-time examples such as “3 hours ago” illustrate formatting; they do not replace the post's actual age.

## REQ-FUNC-VOTE Voting Operations

The same authenticated actions apply to available posts and comments. A user may cast either direction, replace it with the opposite direction, or remove it. Each command updates target score and author karma according to the Vote lifecycle. Subscription is irrelevant; bans restrict posts and comments, not voting. Archived communities accept no new vote state changes.

### REQ-FUNC-VOTE-001 Cast an Upvote or Downvote

An authenticated user with no active vote may choose upvote or downvote on any available post or comment, including their own content. Subscription is not required, and a community ban does not prevent voting.

Success creates one active vote and applies its signed score and karma effects. An existing opposite vote follows the change transition; the same direction is a no-change success. A logged-out caller, unknown or deleted target, or archived-community target is refused.

### REQ-FUNC-VOTE-002 Change an Active Vote Direction

The user who cast an active vote may replace upvote with downvote or downvote with upvote on an available target. The user and target remain fixed, no second vote is created, and both aggregates receive the two-point delta in REQ-DOM-VOTE-LIFE-003.

A logged-out caller, another user's vote, or an unavailable or archived target cannot be changed.

### REQ-FUNC-VOTE-003 Remove an Active Vote

The user who cast an active vote may remove it from an available post or comment. The pair returns to no-vote state and its prior score and karma contribution is reversed.

Removing when no vote exists is a no-change success. A later eligible cast may choose either direction. Target deletion removes the vote through the content lifecycle. A logged-out caller or unavailable or archived target cannot invoke user-directed removal.

## REQ-FUNC-COMMENT Comment Operations

Authenticated users may comment on any available post and reply at any depth without subscribing, unless banned. Public thread viewing shows recursively nested replies under a shared sort. Authors may edit or delete their own comments, while community owners and moderators have a separate delete-any action.

### REQ-FUNC-COMMENT-001 Write a Top-Level Comment

An authenticated user who is not banned may add nonblank text directly to any available post in an active community. Subscription is not required.

Success creates a top-level comment with the user as author, no parent, current creation time, and score zero. It casts no automatic author vote, appears in the thread and author's profile, and increments comment count. A logged-out caller, banned user, blank text, unavailable post, or archived community is refused without creating a comment.

### REQ-FUNC-COMMENT-002 Reply to a Comment

An authenticated user who is not banned may add a nonblank reply beneath any available comment in an active community, without subscribing. The parent must belong to the same post.

The reply may occur at any depth and begins with score zero and no automatic author vote. It appears beneath the parent and in the author's profile and increments comment count. An unavailable or deleted-marker parent cannot receive a new reply; invalid actor, ban, text, archive, or cross-post conditions are refused.

### REQ-FUNC-COMMENT-003 View a Nested Comment Thread

Any logged-in or logged-out visitor, including a non-subscriber or banned user, may view the public thread for an available post. Each comment shows author and text, or a neutral deleted marker, plus score, relative age, and nested descendants.

Top-level comments follow shared pagination. Every returned branch preserves all descendant levels, and each sibling set follows the selected comment sort. An unknown or deleted post is not found; a post with no comments returns an empty page.

### REQ-FUNC-COMMENT-004 Sort Comments on a Post

A reader may select Best, New, or Controversial for every sibling set in a thread. Best is the default when no sort is supplied.

Changing sort restarts at the first page and invalidates the prior continuation. Deleted markers keep the position determined by their surviving reply branch rather than a removed score. Any other sort value is refused under REQ-RULE-COMMENT.

### REQ-FUNC-COMMENT-005 Edit an Authored Comment

An authenticated author may replace their available comment's text with valid nonblank text. The post, parent, author, creation time, votes, replies, and reports remain attached.

A banned or unsubscribed author may still correct an existing comment in an active community. A non-author, including a moderator acting only through moderation authority, cannot edit it. Deleted comments, archived communities, and blank text are refused.

### REQ-FUNC-COMMENT-006 Delete an Authored Comment

An authenticated author may permanently remove their available comment content, including after unsubscribing or being banned in an active community. No moderator approval or reason is required.

Deletion follows REQ-DOM-COMMENT-LIFE-002, including a neutral marker when another user's replies remain. Targeting another user's comment or an archived community is refused; an unknown or already deleted comment is not found. Archived content can still be removed transitively by account deletion.

### REQ-FUNC-COMMENT-007 Delete a Community Comment as Moderator

A current community owner or moderator may remove any available comment in that community, regardless of author, nesting depth, score, age, or report state. Moderation authority does not cross community boundaries or apply to archived communities.

Deletion follows REQ-DOM-COMMENT-LIFE-002. Private history records the acting moderator and time without retaining removed text. The author's account, other comments, subscription, and roles remain unchanged. Missing authority or unavailable content is refused.

## REQ-FUNC-ROLE Moderator Assignment Operations

Moderator assignments belong to one active community. Owner and moderator appointment paths have different caller authority, while removal belongs only to the owner. All three commands use the role inheritance, grant, revoke, and protection rules in Community-Scoped Authority.

### REQ-FUNC-ROLE-001 Add a Moderator as Community Owner

A current owner may select one active platform user and appoint them moderator in the owner's active community. Moderator capabilities begin immediately and the target's subscription remains unchanged.

Selecting an existing moderator is a no-change success. A non-owner, deleted target, unknown community, or archived community is refused under REQ-AUTH-ROLE-002.

### REQ-FUNC-ROLE-002 Add a Moderator as Community Moderator

A user whose moderator assignment is current may appoint one active platform user as another moderator in that same active community. The target gains moderator capabilities immediately without a subscription change.

Selecting an existing moderator is a no-change success. Authority from another community, a deleted target, an unknown community, or an archived community is refused under REQ-AUTH-ROLE-003.

### REQ-FUNC-ROLE-003 Remove a Moderator as Community Owner

The current owner may revoke another user's moderator assignment in the owned active community. The former moderator immediately loses scoped moderation capabilities, while subscription, account, authored content, and authority elsewhere remain unchanged.

The owner role cannot be targeted. A non-moderator target produces the no-assignment outcome in REQ-AUTH-ROLE-004. A non-owner caller, protected owner target, unavailable target, unknown community, or archived community is refused.

## REQ-FUNC-BAN Community Ban Operations

Current owners and moderators manage participation bans only in their own active communities. Banning blocks future posts and comments without deleting or hiding existing state. Unbanning removes only that restriction. The private active list lets community moderators identify who is currently blocked.

### REQ-FUNC-BAN-001 Ban a User From a Community

A current owner or moderator may ban an eligible active user in their active community. The target may be a subscriber, non-subscriber, moderator, or the acting moderator, but cannot be the current owner.

Success immediately blocks new posts and comments by that user in the community. Viewing, existing content, votes, reports, subscription, and roles remain unchanged. An existing active ban is a no-change success. An owner target, deleted or unknown user, unknown or archived community, or caller without current scoped authority is refused.

### REQ-FUNC-BAN-002 Unban a User From a Community

A current owner or moderator may end an active ban in their community. Ordinary commenting becomes available again and post creation becomes available when the user has an active subscription.

Subscription and roles remain as they were, and independently deleted content is not restored. An absent ban produces a no-change result identifying that no active ban existed. Unknown users or communities, archives, and callers without current scoped authority are refused.

### REQ-FUNC-BAN-003 View a Community's Banned Users

A current owner or moderator may traverse the active banned-user list for their community. Results are paginated from most recently activated ban to oldest.

Each item shows the banned user's username, activation time, and acting moderator's username. Ended bans and bans from other communities are excluded. No active bans yields an empty page. Public users, moderators of another community, unknown or archived communities, and callers without current authority are refused.

## REQ-FUNC-REPORT Content Reporting and Resolution

An authenticated user may report either a post or comment with a reason. The report enters only that content's community queue. Current owners and moderators inspect all unresolved work and either approve it, deleting the target, or dismiss it, retaining the target. Both decisions remove the decided report from the active queue.

### REQ-FUNC-REPORT-001 Submit a Post or Comment Report

An authenticated user may report any available post or comment in an active community by supplying a nonblank textual reason. The reporter may be a subscriber, non-subscriber, banned user, moderator, content author, or participant from another community.

Success creates one unresolved report and leaves the target available pending a decision. A duplicate unresolved report from the same user for the same target is refused. A logged-out caller, blank reason, unavailable target, or archived community creates no report.

### REQ-FUNC-REPORT-002 View Unresolved Community Reports

A current owner or moderator may traverse every unresolved report in their active community. The queue is paginated from newest submission to oldest.

Each item identifies post or comment target kind and shows the reported content, reporter username, reason, and submission time. Resolved reports and other communities' reports are excluded. No unresolved work yields an empty page. Public users, outside moderators, unknown or archived communities, and callers without current authority are refused.

### REQ-FUNC-REPORT-003 Approve a Report

A current owner or moderator may approve a still-unresolved report in their active community after inspecting its target, reporter, and reason. The target must still be available when the decision begins.

Approval deletes the reported post or comment and applies its dependent deletion lifecycle. It also removes every unresolved report on that target and records the approved history outcome. Missing authority, another or archived community, or a report that is no longer unresolved is refused.

### REQ-FUNC-REPORT-004 Dismiss a Report

A current owner or moderator may dismiss a still-unresolved report in their active community after inspecting its target, reporter, and reason. The target must still be available when the decision begins.

Dismissal keeps the target and other unresolved reports on it unchanged, removes only the decided report from the active queue, and records the dismissed history outcome. Missing authority, another or archived community, or a report that is no longer unresolved is refused.
