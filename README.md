# GodTierPH Ragnarok: The New World Guild Hub

Responsive static website for GodTierPH.

## Pages

- `index.html` - Home, bulletin, top players, raffle winner, news, updates
- `guild-events.html` - Guild Events overview
- `weekly-raffles.html` - Weekly Raffles event page
- `clash-of-gods.html` - 5v5 Clash of Gods event page
- `crown-contribution.html` - Crown of Contribution event page
- `guild-league.html` - Guild League strategy, side maps, live styled party list, roles
- `guild-league-strategy.html` - Full-size Main League strategy maps, instructions, roles, and class notes
- `guild-league-strategy-sub-league.html` - Sub League grouping, target focus, tower timing, and reset calls
- `guild-league-party-list.html` - Live Main League and Sub League party list
- `guild-league-team-combo.html` - Team combo engage and priority target guide
- `guides.html` - Guide hub for strategy, siege routes, builds, and event references
- `schedules.html` - Dungeon assistance schedules
- `media.html` - Media archive for war clips, screenshots, highlights, and guild assets
- `builds.html` - Builds overview and class build menu
- `build-*.html` - Individual class build pages
- `siege.html` - Siege preparation board
- `contact.html` - Guild leadership contacts
- `recruit/index.html` - Recruitment page at `/recruit/`

## Assets

- `assets/godtierph-icon-small.webp` - lightweight guild emblem used in headers and footers
- `assets/godtierph-icon-96.png` - small favicon
- `assets/guild-league-map.webp` - original Guild League battlefield map
- `assets/guild-league-map-blue.webp` - blue-side Guild League map
- `assets/guild-league-map-red.webp` - red-side Guild League map used in the mirrored red plan

## Deploy

This static site can be hosted directly with GitHub Pages from the repository root.

The Guild League party list reads the published Google Sheet CSV in the browser and renders it as styled HTML cards.

## Custom Domain

The repository includes `CNAME` with `www.godtierph.com` for GitHub Pages.

At the domain registrar or DNS provider, point `www` to the GitHub Pages host for the GitHub account, usually `<github-username>.github.io`.
