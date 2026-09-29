# 02 Tasks, Categories, Clients, Projects, And Collaboration

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Tasks are the trackable units of work. They can be categorized, associated with clients/projects, owned by one user, and shared with collaborators.

## Users

- Individuals creating and organizing their work.
- Collaborators contributing time to shared tasks.
- Company dashboard viewers using aggregated task/category rollups.

## Scope

- Create tasks with title, description, category, optional client/project, and owner.
- Treat the Track-page `New team task` action as a collaboration-only flow that requires at least one existing teammate.
- Provide default categories in this order: Software, Hardware, Firmware, Communication, Research, Commerce, Production, Other.
- Allow user-defined categories that persist for future use.
- Share tasks with multiple signed-in users.
- Invite or add collaborators by company email.
- Show shared-task membership and the current user's own time spent on that shared task.
- Allow collaborators to create entries on shared tasks.
- Restrict archive/remove-member actions to the task owner.
- Enforce membership checks in API routes.

## Out Of Scope

- Billing, hourly rates, or client invoicing.
- Individual performance ranking from shared-task contributions.
- Complex project management workflows.
- Task time estimates; this is deferred until there is a clear product need.

## UI Reference

The original `docs/spec.md` includes this collaboration reference, but the current privacy direction narrows the time summary to the signed-in user's own time only:

```text
Manage Collaborators:
+---------------------------------------------------------------+
| Shared task: PCB layout review                                |
+---------------------------------------------------------------+
| Owner: Alex Kim                                               |
| Add collaborator by email                                     |
| [ teammate@airgradient.com............................. ] [+] |
|                                                               |
| Members                                                       |
| Alex Kim       owner                                   [lock] |
| Mina Chen      member                                [remove] |
| Sam Rivera     member                                [remove] |
|                                                               |
| My time spent: 1h 20m                                         |
|                                                               |
| API rules: require task membership for reads/writes; owner    |
| only for archive/remove; company rollups stay aggregated.     |
+---------------------------------------------------------------+
```

The main timer area shows pending invitations. Joined Team tasks appear under `Today's entries` when the user selects the `Team` tab. A Team task is not automatically loaded into the timer after Join; the user chooses when to start working on it.

```text
Today's entries                                   [Individual] [Team]
Team tasks
PCB layout review
Members: Alex Kim, Mina Chen, Sam Rivera
My time spent: 1h 20m
[Track task]  ← soft outline button
```

The Track-page header action is labelled `New team task`. Its dialog requires at least one teammate who already has an account. After creation, the task appears immediately in the owner's `Today's entries` → `Team` list and as a pending invitation for each selected teammate. Creating or joining it never starts the timer automatically.

## Functional Requirements

- Task title is required.
- `New team task` requires at least one valid teammate other than the owner; the submit action remains unavailable until one is selected.
- The server rejects collaboration-mode task creation when no valid teammate can be resolved, while inline task creation remains available for individual work.
- A newly created Team task is visible to its owner immediately, before invitees accept.
- Task creation supports category, client/project, and description.
- Categories include defaults and user-defined additions.
- Shared tasks are visible to all members.
- Each time entry remains owned by the user who tracked it.
- Team-task time summaries show only the signed-in user's own tracked time on that shared task.
- Team-task member lists may show who belongs to the shared task, but must not show another member's tracked duration.
- In `Today's entries` → `Team`, the action label is `Track task` and it uses a soft outline button treatment so it is visibly clickable without competing with the primary timer action. Selecting it fills the timer draft without starting time. If the user changes their mind before starting, the same row changes to `Cancel` and clears the draft. Once tracking has started for that task, the row can show `Tracking`.
- Task owners can add/remove collaborators.
- Only task owners can archive tasks or remove other members.
- Company dashboard may include aggregated shared-task activity without individual names, task titles, or person-level timing.

## Data And API

Relevant target data:

- `categories`
- `clients`
- `projects`
- `tasks`
- `task_members`
- `task_invites`
- `tracking_presence`
- `time_entries`

Relevant current API files:

- `backend/api/tasks.post.ts`
- `backend/api/tasks-share.post.ts`
- `backend/api/invitations.post.ts`
- `backend/api/bootstrap.get.ts`
- `backend/utils/store.ts`

## Current Implementation

- `backend/prisma/seed.mjs` seeds users, categories, clients, projects, tasks, members, and invitations.
- Runtime bootstrap and seed share the canonical default category list: Software, Hardware, Firmware, Communication, Research, Commerce, Production, Other.
- `createTask` creates tasks and pending invitations through Prisma for existing user IDs passed as members.
- Collaboration-mode `createTask` rejects empty or invalid teammate selections so a Team task cannot silently become an individual task.
- `shareTask` lets the task owner create pending persisted invitations.
- `acceptTaskInvitation` accepts an invitation and upserts the recipient into task members.
- `startEntry` checks owner/member access before tracking a shared task.
- `publicState` keeps detailed entries owner-only and returns shared-task summaries only for accepted task members, with member names and the signed-in user's own seconds only. It does not return team total seconds, per-contributor seconds, notes, locations, pauses, blockers, or feedback detail from other members.
- `buildDashboards` currently reduces persisted tracking presence to one company-wide active shared-session count without exposing task titles, source task IDs, contributor names, or user IDs. Its current team filter is legacy; the target Company Dashboard filters presence through the shared task's stable `categoryId`.
- `frontend/app.vue` includes collaboration-only Team task creation, individual inline task drafting, share modal, pending invite acceptance, and Team-task rows inside Today's entries; the company surface displays aggregate shared-task activity only.
- Pending collaborator invites are shown in the Track page sharing area as notification-style cards with a bell icon, the `Task invitation` label, inviter name, task title, and a clear `Join` action. The visual treatment uses soft blue information styling so the invite is noticeable but not confused with an error or warning.

## Gaps

- Runtime data is persisted in PostgreSQL through Prisma.
- Collaborators are selected by existing user ID in the UI, not added by email as specified.
- User-defined category creation/editing is not complete.
- Client/project creation and editing are not exposed as full workflows.
- Owner-only archive and remove-member actions are not implemented.
- `task_members` includes role, invited-by user, and joined timestamp.
- `task_invites` and `tracking_presence` are present in the Prisma schema.
- The privacy-safe shared-task summary exists at the API layer but is not represented as a full collaborator-management view.

## Acceptance Criteria

- A user can create a task with category and optional project/client metadata.
- A user creating a task from `New team task` must select at least one existing teammate, and the owner sees the result in Team entries immediately.
- A task owner can invite a collaborator by company email.
- A collaborator can accept the invite and track time on the shared task.
- Shared tasks show members and the signed-in user's own time spent.
- Non-members cannot read, edit, track, or export another contributor's detailed entry data; accepted members receive only the dedicated collaborative effort summary.
- Accepted members must not receive another contributor's tracked duration.
- Only the owner can archive a task or remove collaborators.

## Tests And Verification

- API tests cover invitation membership, owner-only sharing, owner-only detailed entry DTOs, own-time-only shared summaries, unrelated viewers, and anonymous aggregate/category-filtered presence; archive/remove-member operations remain deferred with their UI.
- Unit tests for collaborator effort rollups.
- Browser check: create task, invite collaborator, accept invite, confirm the task appears in Today's entries → Team without auto-loading into the timer, manually choose it, track the user's own time, and confirm no other member duration is exposed.
