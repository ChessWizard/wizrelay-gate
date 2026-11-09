<!-- nav -->
[wizrelay-gate](../../README.md) · [Documentation](README.md) · [Türkçe](../tr/03-initialize.md)
<!-- /nav -->

# Setting up the panel

The first person to sign in is the owner, created from `OWNER_EMAIL` and `OWNER_PASSWORD`
on first boot. They are taken to **Set up the panel**, which is four things.

## 1 · Panel

The name, logo and favicon this installation shows. These start from `PANEL_NAME`,
`PANEL_LOGO_URL` and `PANEL_FAVICON_URL`, and anything set here overrides them.

## 2 · Hub

Paste the hub repository link, or point at a working copy already on the server. The panel
reads `wizrelay-hub.json` for the hub's name, tracker and role catalogue, and clones it so
the packages can be read. A URL with credentials in it is refused.

A team may connect more than one hub; the switcher in the top bar moves between them.

## 3 · Projects

A repository for each hub role, chosen from the repositories your **GitHub token** can
see. Connect the token under [Settings → Connections](12-settings.md) and the list fills
itself; search it, pick one, give it a role.

There used to be three ways to do this — pick a folder on the panel's machine, paste a
clone URL, or type one for an agent to clone. On a shared panel the first describes a
filesystem no gate ever touches, because the work happens on people's own machines, and
the other two are a line somebody has to copy correctly from somewhere else. The panel
clones nothing here: it records the repository, and whichever machine runs the gate is the
machine that already has it.

The role comes from the repository's own `.wizrelay/config.json` when it has one; the
dropdown is only a fallback. Each project gets a research lead, which starts as the owner
and is who an unaddressed question falls to — see [The question loop](11-questions.md).

## 4 · People

Add the people who will work here by the email their Claude account uses, and send them
the invitation link the panel produces. Give each of them Researcher or Developer in the
projects they work in — see [People, roles and activity](18-activity.md).

## Finishing

**Finish setup** opens the panel to everyone. Until then, anyone else who signs in is told
the panel is still being set up.

<!-- foot -->
← Previous: [Install and run](02-install.md) · [Documentation](README.md) · Next: [The nine task quality gates](04-gates.md) →
<!-- /foot -->
