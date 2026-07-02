# 02 Tasks, Categories, Clients, Projects, And Collaboration

Source: extracted from the preserved full brief in `docs/spec.md`.

## Summary

Tasks are the trackable units of work. They can be categorized, associated with clients/projects, estimated, owned by one user, and shared with collaborators.

## Users

- Individuals creating and organizing their work.
- Collaborators contributing time to shared tasks.
- Company dashboard viewers using aggregated task/category/team rollups.

## Scope

- Create tasks with title, description, category, optional client/project, optional time estimate, and owner.
- Provide default categories: Deep work, Meeting, Admin, Comms, Research, Other.
- Allow user-defined categories that persist for future use.
- Share tasks with multiple signed-in users.
- Invite or add collaborators by company email.
- Show combined effort, per-contributor effort, and who is tracking now.
- Allow collaborators to create entries on shared tasks.
- Restrict archive/remove-member actions to the task owner.
- Enforce membership checks in API routes.

## Out Of Scope

- Billing, hourly rates, or client invoicing.
- Individual performance ranking from shared-task contributions.
- Complex project management workflows.

## UI Reference

The original `docs/spec.md` includes this collaboration reference:

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
| Alex Kim       owner    2h 40m    tracking now       [lock]   |
| Mina Chen      member   1h 05m                       [remove] |
| Sam Rivera     member   0h 45m                       [remove] |
|                                                               |
| API rules: require task membership for reads/writes; owner    |
| only for archive/remove; company rollups stay aggregated.     |
+---------------------------------------------------------------+
```

The main timer mockup also includes the collaborator summary:

```text
Collaborators
Alex Kim      ##########..........  42%  (tracking now)
Mina Chen     ######..............  25%
[ Manage collaborators ]
```

## Functional Requirements

- Task title is required.
- Task creation supports category, client/project, estimate, and description.
- Categories include defaults and user-defined additions.
- Shared tasks are visible to all members.
- Each time entry remains owned by the user who tracked it.
- Task owners can add/remove collaborators.
- Only task owners can archive tasks or remove other members.
- Shared-task totals may be included in company dashboard aggregation without becoming individual ranking.

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
- `createTask` creates tasks and pending invitations through Prisma for existing user IDs passed as members.
- `shareTask` lets the task owner create pending persisted invitations.
- `acceptTaskInvitation` accepts an invitation and upserts the recipient into task members.
- `startEntry` checks owner/member access before tracking a shared task.
- `buildDashboards` exposes `activeTrackers` from persisted tracking presence.
- `frontend/app.vue` includes task creation, inline task drafting, share modal, pending invite acceptance, and active tracker display.

## Gaps

- Runtime data is persisted in PostgreSQL through Prisma.
- Collaborators are selected by existing user ID in the UI, not added by email as specified.
- User-defined category creation/editing is not complete.
- Client/project creation and editing are not exposed as full workflows.
- Owner-only archive and remove-member actions are not implemented.
- `task_members` includes role, invited-by user, and joined timestamp.
- `task_invites` and `tracking_presence` are present in the Prisma schema.
- Per-contributor effort is not represented as a full collaborator management view.

## Acceptance Criteria

- A user can create a task with category and optional project/client metadata.
- A task owner can invite a collaborator by company email.
- A collaborator can accept the invite and track time on the shared task.
- Shared tasks show combined effort, per-contributor effort, and active tracking presence.
- Non-members cannot read, edit, track, or export shared-task data.
- Only the owner can archive a task or remove collaborators.

## Tests And Verification

- API tests for task creation, sharing, invitation acceptance, membership enforcement, and owner-only operations.
- Unit tests for collaborator effort rollups.
- Browser check: create task, invite collaborator, accept invite, track shared task, confirm active tracker and rollups.
