<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/18-activity.md)
<!-- /nav -->

# People, roles and activity

## Signing in

Nobody signs up. The first owner comes from `OWNER_EMAIL` and `OWNER_PASSWORD` on first
boot; after that an owner or an admin adds someone by the email their Claude account
uses, and sends them the invitation link the panel produces. The link works once, and the
person sets their own password with it.

## Roles

Two kinds, because two different questions are being answered.

**Panel roles** say what someone may do to the panel itself:

| Role | May |
|---|---|
| **Owner** | Everything, including the panel's name, logo and setup. There is exactly one, and it cannot be reassigned in the panel. |
| **Admin** | Add hubs, projects and people; assign roles at their own level and below; reach every project. |
| **Member** | Work in the projects they are a member of. |

**Project roles** say what someone may do in one repository, and a person may hold both:

| Role | Runs |
|---|---|
| **Researcher** | The research track — intake, research, validate, publish. |
| **Developer** | The delivery track — pull, plan, implement, verify, ship. |

A gate refuses a role that does not own its track. An admin may run anything.

## Who hears about a question

Every project has a research lead, which starts as the owner and can be changed per
project. When a run stops on a question, it lands in that person's inbox with the project
and relay it came from. There is no push channel: the inbox is read when a page loads.

## Where these screens are

**People** is its own page in the rail: who is on the panel, their panel role, the
projects they are in and when they last signed in. Everybody can read it, because
"who else is on this project" is not a question that should need a permission.

Changing any of it is an administrator's, and that happens under **Administration**,
which is one page with three tabs:

| Tab | Holds |
|---|---|
| **General** | The panel's own name, description, logo and favicon. |
| **Hubs** | The connected hubs and the projects under each. |
| **People** | Invitations, panel roles, and who may be disabled or removed. |

They are tabs rather than three pages because it is still one screen; the tab is in the
URL, so it is a link, the back button works, and a reload lands where it left off.

One person's roles are edited on their own page, with the same control the invitation
uses — a card per role that says what the role lets somebody do. It used to be tick boxes
in one place and a different-looking row of buttons in another, so the same decision
looked like two unrelated things.

## What activity holds

Only what people did to tasks: a gate ran and how it ended, a prompt was answered, a
question was asked and answered, a package was published.

Sign-ins, hubs connected and members given a role are not here. They are real events but
they belong to administration, and in the same feed the one thing anybody opens it for —
*who ran that gate and what did it say* — scrolled past between them.

A gate gets one row, written **when it ends**, carrying the verdict. It used to be
written when the button was pressed, so the log could say a gate ran and never say
whether it passed.

## Whose activity you see

Your own, unless you administer the panel. An owner or an admin sees everybody's, and can
narrow the log to one person with the chips above it — the people who have actually done
something, not everybody who can sign in. The filter is in the URL, so a filtered log is
a link.

This is narrower than it was, and deliberately: a feed of other people's work is not
something a member needs in order to do theirs, and an audit trail is an administrator's
instrument. [Who sees what](20-access.md) has the rest of the access rules.

## Reading further back

Newest first, forty at a time, with **Older** at the foot.

Paged by cursor rather than by page number, because the log is written to while it is
being read: a gate finishing shifts every row down, so page two of a numbered query skips
whatever arrived in between and shows it again on page three. A cursor is a position in
the list, so what you have read stays read. Going back a page is the back button.

A row that names nobody was written before the panel recorded who started a run. Every
row written now carries a person — including a gate that crashed, which used to leave no
row at all.

Commits, pull requests and ClickUp comments are not copied here — they are read from
GitHub and ClickUp where they already live.

## Connections

Each person connects their own ClickUp and GitHub from **Connections**, and the panel acts
as them when it reads a task or pushes a branch. Tokens are encrypted with the server key
and never shown again. A shared `CLICKUP_API_TOKEN` or `GITHUB_TOKEN` in the environment
is the fallback when someone has not connected their own.

<!-- foot -->
← Previous: [Running on a server](17-docker.md) · [Documentation](README.md) · Next: [Running on your own machine](19-agent.md) →
<!-- /foot -->
