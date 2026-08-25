const btn = document.getElementById('menuBtn');
const nav = document.getElementById('mainNav');
const navGroups = nav ? Array.from(nav.querySelectorAll('.nav-group')) : [];
const hoverMenuQuery = window.matchMedia?.('(hover: hover) and (pointer: fine)');

function getNavGroupTrigger(group) {
  return Array.from(group.children).find((child) => child.matches('a'));
}

function setNavGroupOpen(group, open) {
  group.classList.toggle('open', open);
  getNavGroupTrigger(group)?.setAttribute('aria-expanded', String(open));
}

function closeNavGroups(except = null) {
  navGroups.forEach((group) => {
    if (group !== except) setNavGroupOpen(group, false);
  });
}

btn?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', String(open));
});

navGroups.forEach((group) => {
  let closeTimer;

  group.addEventListener('mouseenter', () => {
    if (!hoverMenuQuery?.matches) return;
    clearTimeout(closeTimer);
    closeNavGroups(group);
    setNavGroupOpen(group, true);
  });

  group.addEventListener('mouseleave', () => {
    if (!hoverMenuQuery?.matches) return;
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => setNavGroupOpen(group, false), 180);
  });

  group.addEventListener('focusin', () => {
    if (!hoverMenuQuery?.matches) return;
    closeNavGroups(group);
    setNavGroupOpen(group, true);
  });

  group.addEventListener('focusout', (event) => {
    if (!hoverMenuQuery?.matches) return;
    if (!group.contains(event.relatedTarget)) setNavGroupOpen(group, false);
  });
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', (event) => {
    const navGroup = link.parentElement;
    const submenu = link.nextElementSibling;
    const isSubmenuTrigger = navGroup?.classList.contains('nav-group') && submenu?.classList.contains('submenu');

    if (isSubmenuTrigger) {
      event.preventDefault();
      const shouldOpen = hoverMenuQuery?.matches || !navGroup.classList.contains('open');
      closeNavGroups(navGroup);
      setNavGroupOpen(navGroup, shouldOpen);
      return;
    }

    closeNavGroups();
    nav.classList.remove('open');
    btn?.setAttribute('aria-expanded', 'false');
  });
});

document.addEventListener('click', (event) => {
  if (!nav?.contains(event.target)) {
    closeNavGroups();
  }
});

(function initHeroVideos() {
  const heroes = document.querySelectorAll('[data-home-hero], [data-video-hero]');

  heroes.forEach((hero) => {
    const video = hero.querySelector('[data-home-hero-video], [data-video-hero-video]');

    if (!video) return;

    function showStaticHero() {
      hero.classList.remove('video-ready');
      hero.classList.add('video-ended');
      video.pause();
    }

    video.addEventListener('playing', () => {
      if (!hero.classList.contains('video-ended')) {
        hero.classList.add('video-ready');
      }
    }, { once: true });

    video.addEventListener('ended', showStaticHero);
    video.addEventListener('error', () => {
      hero.classList.add('video-unavailable');
    }, { once: true });

    const playAttempt = video.play();
    if (playAttempt?.catch) {
      playAttempt.catch(() => hero.classList.add('video-unavailable'));
    }
  });
}());

(function initImageLightbox() {
  const lightbox = document.getElementById('imageLightbox');
  const lightboxImage = document.getElementById('imageLightboxImage');
  const lightboxPanel = lightbox?.querySelector('.image-lightbox-panel');
  const lightboxTriggers = document.querySelectorAll('[data-lightbox-src]');
  let lastFocusedTrigger = null;

  if (!lightbox || !lightboxImage || !lightboxPanel || !lightboxTriggers.length) return;

  function openLightbox(trigger) {
    const src = trigger.dataset.lightboxSrc;
    if (!src) return;

    lastFocusedTrigger = trigger;
    lightboxImage.src = src;
    lightboxImage.alt = trigger.dataset.lightboxAlt || trigger.querySelector('img')?.alt || 'Enlarged image preview';
    lightbox.hidden = false;
    document.body.classList.add('modal-open');
    lightboxPanel.focus();
  }

  function closeLightbox() {
    if (lightbox.hidden) return;

    lightbox.hidden = true;
    document.body.classList.remove('modal-open');
    lightboxImage.removeAttribute('src');
    lastFocusedTrigger?.focus();
  }

  lightboxTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openLightbox(trigger));
  });

  lightbox.querySelectorAll('[data-close-lightbox]').forEach((control) => {
    control.addEventListener('click', closeLightbox);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });
}());

const partyList = document.getElementById('partyList');
const partyListStatus = document.getElementById('partyListStatus');
const refreshPartyList = document.getElementById('refreshPartyList');
const leagueTabs = document.querySelectorAll('[data-league]');
const partySearchForm = document.getElementById('partySearchForm');
const partySearchInput = document.getElementById('partySearchInput');
const partyNameSuggestions = document.getElementById('partyNameSuggestions');
const partySearchHelp = document.getElementById('partySearchHelp');
const partyLookupModal = document.getElementById('partyLookupModal');
const partyLookupResults = document.getElementById('partyLookupResults');
const partyLookupTitle = document.getElementById('partyLookupTitle');
const partyLookupCard = partyLookupModal?.querySelector('.party-lookup-card');
const rosterCsvUrls = {
  main: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmWixlFa2eg6ORNNiO7YTGoWqjBoiuVjwxHQeKB1N8xu08sN_P-5hSQp8Kcm_y7Q/pub?gid=495643243&single=true&output=csv',
  sub: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmWixlFa2eg6ORNNiO7YTGoWqjBoiuVjwxHQeKB1N8xu08sN_P-5hSQp8Kcm_y7Q/pub?gid=1609318158&single=true&output=csv',
};
const leagueLabels = {
  main: 'Main League',
  sub: 'Sub League',
};
let activeLeague = 'main';
const rosterCache = {};
let rosterLookupEntries = [];
let rosterLoadToken = 0;

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows;
}

function isBlankRow(row) {
  return row.every((cell) => !cell);
}

function normalizePartyName(sectionName, partyName, partyIndex) {
  if (/^team\s+2\s+main/i.test(sectionName)) {
    return `Party ${partyIndex + 1}`;
  }

  return partyName;
}

function parseRoster(rows) {
  const sections = [];
  let index = 0;

  while (index < rows.length) {
    const row = rows[index];
    const filled = row.filter(Boolean);
    const sectionName = filled.length === 1 && /^team\s+\d+/i.test(filled[0]) ? filled[0] : '';

    if (!sectionName) {
      index += 1;
      continue;
    }

    const header = rows[index + 1] || [];
    const partyColumns = header
      .map((cell, column) => ({ cell, column }))
      .filter(({ cell }) => /^party\s+\d+/i.test(cell));
    const parties = partyColumns.map(({ cell, column }, partyIndex) => ({
      name: normalizePartyName(sectionName, cell, partyIndex),
      members: [],
      nameColumn: column,
      jobColumn: column + 1,
    }));

    index += 2;
    while (index < rows.length) {
      const memberRow = rows[index];
      const filledMemberRow = memberRow.filter(Boolean);
      const nextSection = filledMemberRow.length === 1 && /^team\s+\d+/i.test(filledMemberRow[0]);

      if (nextSection) break;
      if (!isBlankRow(memberRow)) {
        const rowLabelText = memberRow[0] || '';
        const rowLabel = rowLabelText.toLowerCase();
        parties.forEach((party) => {
          const name = memberRow[party.nameColumn] || '';
          const job = memberRow[party.jobColumn] || '';
          if (name || job) {
            party.members.push({
              name: name || 'TBA',
              job: job || 'TBA',
              roleLabel: rowLabelText,
              partyLeader: rowLabel.includes('party leader'),
              teamLeader: rowLabel.includes('team leader'),
              leader: rowLabel.includes('party leader') || rowLabel.includes('team leader'),
            });
          }
        });
      }
      index += 1;
    }

    sections.push({
      name: sectionName,
      parties: parties.filter((party) => party.members.length),
    });
  }

  return sections;
}

function textNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function renderRoster(sections) {
  if (!partyList) return;
  partyList.replaceChildren();

  if (!sections.length) {
    partyList.append(textNode('div', 'empty-row', 'No party list data found yet.'));
    return;
  }

  sections.forEach((section) => {
    const sectionNode = document.createElement('section');
    sectionNode.className = 'party-section';

    const header = document.createElement('div');
    header.className = 'party-section-header';
    header.append(textNode('h3', '', section.name));

    const counts = document.createElement('div');
    counts.className = 'party-counts';
    const memberCount = section.parties.reduce((total, party) => total + party.members.length, 0);
    counts.append(textNode('span', 'status-pill', `${section.parties.length} parties`));
    counts.append(textNode('span', 'status-pill', `${memberCount} members`));
    header.append(counts);
    sectionNode.append(header);

    const grid = document.createElement('div');
    grid.className = 'party-grid';
    section.parties.forEach((party) => {
      const card = document.createElement('article');
      card.className = 'party-card';

      const cardHeader = document.createElement('div');
      cardHeader.className = 'party-card-header';
      cardHeader.append(textNode('h4', '', party.name));
      cardHeader.append(textNode('span', 'status-pill', `${party.members.length}/5`));
      card.append(cardHeader);

      const members = document.createElement('div');
      members.className = 'party-members';
      party.members.forEach((member) => {
        const item = document.createElement('div');
        item.className = member.leader ? 'party-member leader' : 'party-member';
        item.append(textNode('span', 'member-name', member.name));
        item.append(textNode('span', 'member-job', member.leader ? `${member.job} - ${getMemberRole(member)}` : member.job));
        members.append(item);
      });
      card.append(members);
      grid.append(card);
    });

    sectionNode.append(grid);
    partyList.append(sectionNode);
  });
}

function normalizeSearchValue(value) {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getTeamLabel(sectionName) {
  const match = String(sectionName).match(/team\s+(\d+)/i);
  return match ? `Team ${match[1]}` : sectionName;
}

function getPartyLeader(party) {
  return party.members.find((member) => member.partyLeader);
}

function getMemberRole(member) {
  if (member.teamLeader) return 'Team Leader';
  if (member.partyLeader) return 'Party Leader';
  return 'Member';
}

function getTeamLeader(section) {
  const explicitLeader = section.parties
    .flatMap((party) => party.members.map((member) => ({ party, member })))
    .find(({ member }) => member.teamLeader);

  if (explicitLeader) {
    return `${explicitLeader.member.name} (Team Leader)`;
  }

  const firstPartyLeader = section.parties
    .map((party) => ({ party, member: getPartyLeader(party) }))
    .find(({ member }) => member);

  if (firstPartyLeader) {
    return `${firstPartyLeader.member.name} (${firstPartyLeader.party.name} leader)`;
  }

  return 'Not listed in sheet';
}

function buildRosterLookupEntries() {
  return Object.entries(rosterCache).flatMap(([league, sections]) => {
    const leagueLabel = leagueLabels[league] || league;

    return sections.flatMap((section) => {
      const teamLabel = getTeamLabel(section.name);
      const teamLeader = getTeamLeader(section);

      return section.parties.flatMap((party) => {
        const partyLeader = getPartyLeader(party);
        const partyLeaderName = partyLeader?.name || 'Not listed in sheet';
        const partyMembers = party.members.map((member) => ({
          name: member.name,
          job: member.job,
          role: getMemberRole(member),
          leader: member.leader,
        }));
        return party.members
          .filter((member) => normalizeSearchValue(member.name) && normalizeSearchValue(member.name) !== 'tba')
          .map((member) => ({
            name: member.name,
            job: member.job,
            league,
            leagueLabel,
            team: teamLabel,
            teamRaw: section.name,
            teamLeader,
            party: party.name,
            partyLeader: partyLeaderName,
            role: getMemberRole(member),
            partyMembers,
          }));
      });
    });
  });
}

function updatePartyLookupOptions() {
  if (!partySearchForm) return;

  rosterLookupEntries = buildRosterLookupEntries();
  const names = [...new Set(rosterLookupEntries.map((entry) => entry.name))]
    .sort((a, b) => a.localeCompare(b));

  partyNameSuggestions?.replaceChildren(...names.map((name) => {
    const option = document.createElement('option');
    option.value = name;
    return option;
  }));

  if (partySearchInput) partySearchInput.disabled = !names.length;
  if (partySearchHelp) {
    partySearchHelp.textContent = names.length
      ? `${names.length} names loaded from Main League and Sub League.`
      : 'No names loaded yet. Refresh the roster and try again.';
  }
}

async function fetchLeagueRoster(league) {
  const rosterCsvUrl = rosterCsvUrls[league];
  const response = await fetch(`${rosterCsvUrl}&cache=${Date.now()}`);
  if (!response.ok) throw new Error(`${leagueLabels[league]} roster request failed`);
  const csv = await response.text();
  return parseRoster(parseCsv(csv));
}

function renderActiveRoster() {
  if (!partyList) return;
  const sections = rosterCache[activeLeague] || [];
  renderRoster(sections);
}

async function loadPartyList() {
  if (!partyList && !partySearchForm) return;

  const currentToken = ++rosterLoadToken;
  const leagueLabel = leagueLabels[activeLeague] || 'Party List';
  if (partyListStatus) partyListStatus.textContent = `Updating ${leagueLabel}`;

  const leagueKeys = Object.keys(rosterCsvUrls);
  const results = await Promise.allSettled(leagueKeys.map(async (league) => ({
    league,
    sections: await fetchLeagueRoster(league),
  })));

  if (currentToken !== rosterLoadToken) return;

  let updatedCount = 0;
  results.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    rosterCache[result.value.league] = result.value.sections;
    updatedCount += 1;
  });

  updatePartyLookupOptions();

  if (!updatedCount) {
    if (partyList) {
      partyList.replaceChildren(textNode('div', 'error-row', 'Could not load the party list yet. Please refresh again while Google updates the published sheet.'));
    }
    if (partyListStatus) partyListStatus.textContent = 'Roster unavailable';
    if (partySearchHelp) partySearchHelp.textContent = 'Roster search is unavailable right now. Please refresh again in a moment.';
    return;
  }

  renderActiveRoster();
  if (partyListStatus) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    partyListStatus.textContent = `${leagueLabel} updated ${time}`;
  }
}

function setActiveLeague(league) {
  if (!rosterCsvUrls[league] || league === activeLeague) return;
  activeLeague = league;
  leagueTabs.forEach((tab) => {
    const isActive = tab.dataset.league === activeLeague;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  if (rosterCache[activeLeague]) {
    renderActiveRoster();
    if (partyListStatus) partyListStatus.textContent = `${leagueLabels[activeLeague]} loaded`;
  } else {
    loadPartyList();
  }
}

function detailRow(label, value) {
  const row = document.createElement('div');
  const term = document.createElement('dt');
  const detail = document.createElement('dd');
  term.textContent = label;
  detail.textContent = value;
  row.append(term, detail);
  return row;
}

function renderLookupMember(member, selectedName = '') {
  const row = document.createElement('div');
  const isSelected = normalizeSearchValue(member.name) === normalizeSearchValue(selectedName);
  row.className = [
    'lookup-member-row',
    member.leader ? 'leader' : '',
    isSelected ? 'selected' : '',
  ].filter(Boolean).join(' ');
  row.append(textNode('span', 'lookup-member-name', member.name));

  const meta = document.createElement('span');
  meta.className = 'lookup-member-meta';
  meta.append(textNode('span', 'lookup-member-job', member.job));
  if (member.role !== 'Member') {
    meta.append(textNode('span', 'lookup-member-role', member.role));
  }
  row.append(meta);
  return row;
}

function renderLookupPartyMembers(entry) {
  const section = document.createElement('section');
  section.className = 'lookup-members-section';
  section.append(textNode('h4', '', 'Your Party Members'));

  const list = document.createElement('div');
  list.className = 'lookup-member-list';
  entry.partyMembers.forEach((member) => {
    list.append(renderLookupMember(member, entry.name));
  });
  section.append(list);
  return section;
}

function renderLookupMatch(entry) {
  const card = document.createElement('article');
  card.className = 'lookup-result-card';

  const header = document.createElement('div');
  header.className = 'lookup-result-header';
  const title = textNode('h3', '', entry.name);
  const job = textNode('span', 'status-pill blue-pill', entry.job);
  header.append(title, job);

  const details = document.createElement('dl');
  details.className = 'lookup-details';
  details.append(
    detailRow('League', entry.leagueLabel),
    detailRow('Team', entry.team),
    detailRow('Party', entry.party),
    detailRow('Role', entry.role),
    detailRow('Team Leader', entry.teamLeader),
    detailRow('Party Leader', entry.partyLeader),
  );

  card.append(header, details, renderLookupPartyMembers(entry));
  return card;
}

function openPartyLookup(query) {
  if (!partyLookupModal || !partyLookupResults || !partyLookupTitle) return;

  const search = query.trim();
  if (!search) {
    if (partySearchHelp) partySearchHelp.textContent = 'Type your character name first.';
    partySearchInput?.focus();
    return;
  }

  if (!rosterLookupEntries.length) {
    if (partySearchHelp) partySearchHelp.textContent = 'Names are still loading. Try again in a moment.';
    return;
  }

  const normalizedSearch = normalizeSearchValue(search);
  const exactMatches = rosterLookupEntries.filter((entry) => normalizeSearchValue(entry.name) === normalizedSearch);
  const matches = exactMatches.length
    ? exactMatches
    : rosterLookupEntries.filter((entry) => normalizeSearchValue(entry.name).includes(normalizedSearch)).slice(0, 8);

  partyLookupResults.replaceChildren();

  if (!matches.length) {
    partyLookupTitle.textContent = 'No party assignment found';
    partyLookupResults.append(textNode('div', 'empty-row', `No roster match found for "${search}". Check the spelling or press Refresh List after the sheet updates.`));
  } else {
    partyLookupTitle.textContent = `${matches.length} assignment${matches.length === 1 ? '' : 's'} found`;
    matches.forEach((entry) => partyLookupResults.append(renderLookupMatch(entry)));
  }

  partyLookupModal.hidden = false;
  document.body.classList.add('modal-open');
  partyLookupCard?.focus();
}

function closePartyLookup() {
  if (!partyLookupModal) return;
  partyLookupModal.hidden = true;
  document.body.classList.remove('modal-open');
  partySearchInput?.focus();
}

partySearchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  openPartyLookup(partySearchInput?.value || '');
});

partySearchInput?.addEventListener('change', () => {
  const value = partySearchInput.value;
  if (rosterLookupEntries.some((entry) => normalizeSearchValue(entry.name) === normalizeSearchValue(value))) {
    openPartyLookup(value);
  }
});

partyLookupModal?.querySelectorAll('[data-close-party-lookup]').forEach((control) => {
  control.addEventListener('click', closePartyLookup);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && partyLookupModal && !partyLookupModal.hidden) {
    closePartyLookup();
  }
});

leagueTabs.forEach((tab) => {
  tab.addEventListener('click', () => setActiveLeague(tab.dataset.league));
});
refreshPartyList?.addEventListener('click', loadPartyList);
if (partyList || partySearchForm) {
  loadPartyList();
  setInterval(loadPartyList, 5 * 60 * 1000);
}

(function initOnlineUsersWidget() {
  if (document.getElementById('onlineUsersWidget')) return;

  const storagePrefix = 'godtierphPresence:';
  const sessionKey = 'godtierphPresenceSession';
  const ttl = 18000;
  const heartbeatDelay = 6000;
  const liveHost = /(^|\.)godtierph\.com$/i.test(window.location.hostname);
  const defaultEndpoint = liveHost ? 'https://godtierph-presence.godtierph.workers.dev/api/presence' : '';
  const endpoint = window.GODTIERPH_PRESENCE_ENDPOINT || defaultEndpoint;

  function safeSessionId() {
    try {
      let id = sessionStorage.getItem(sessionKey);
      if (!id) {
        id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(sessionKey, id);
      }
      return id;
    } catch (error) {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }
  }

  const sessionId = safeSessionId();
  const widget = document.createElement('aside');
  widget.className = 'online-users-widget';
  widget.id = 'onlineUsersWidget';
  widget.setAttribute('aria-label', 'Current users online');
  widget.innerHTML = `
    <span class="online-users-icon" aria-hidden="true"><span class="online-users-pulse"></span></span>
    <span class="online-users-copy">
      <strong class="online-users-count" id="onlineUsersCount">1</strong>
      <span class="online-users-label">Online now</span>
    </span>
  `;
  document.body.append(widget);

  const countNode = document.getElementById('onlineUsersCount');

  function setCount(value) {
    const count = Math.max(1, Number.parseInt(value, 10) || 1);
    countNode.textContent = count.toLocaleString();
  }

  function localPresenceCount() {
    const now = Date.now();
    let count = 1;

    try {
      localStorage.setItem(`${storagePrefix}${sessionId}`, String(now));

      count = Object.keys(localStorage).reduce((total, key) => {
        if (!key.startsWith(storagePrefix)) return total;

        const lastSeen = Number(localStorage.getItem(key));
        if (!lastSeen || now - lastSeen > ttl) {
          localStorage.removeItem(key);
          return total;
        }

        return total + 1;
      }, 0);
    } catch (error) {
      count = 1;
    }

    return Math.max(1, count);
  }

  async function syncPresence(localCount) {
    if (!endpoint) {
      setCount(localCount);
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          path: window.location.pathname,
          active: true,
          timestamp: Date.now(),
        }),
        cache: 'no-store',
        keepalive: true,
      });
      if (!response.ok) throw new Error('Presence request failed');

      const data = await response.json();
      setCount(data.online ?? data.count ?? localCount);
    } catch (error) {
      setCount(localCount);
    }
  }

  function heartbeat() {
    syncPresence(localPresenceCount());
  }

  function releasePresence() {
    try {
      localStorage.removeItem(`${storagePrefix}${sessionId}`);
    } catch (error) {
      // Storage can be unavailable in private browsing.
    }

    if (endpoint && navigator.sendBeacon) {
      const body = JSON.stringify({
        sessionId,
        path: window.location.pathname,
        active: false,
        timestamp: Date.now(),
      });
      navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
    }
  }

  window.addEventListener('storage', heartbeat);
  window.addEventListener('pagehide', releasePresence);
  heartbeat();
  window.setInterval(heartbeat, heartbeatDelay);
}());

(function initStormIntro() {
  const seenKey = 'godtierphStormIntroSeen';
  const thunderKey = 'godtierphThunderPlayed';
  const homePath = window.location.pathname.replace(/\/index\.html$/i, '/') || '/';
  const isHomePage = homePath === '/';
  const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

  function getSessionFlag(key) {
    try {
      return sessionStorage.getItem(key) === 'true';
    } catch (error) {
      return false;
    }
  }

  function setSessionFlag(key) {
    try {
      sessionStorage.setItem(key, 'true');
    } catch (error) {
      // Private browsing can block sessionStorage; keep the effect graceful.
    }
  }

  function createBolt(left, delay) {
    const bolt = document.createElement('div');
    bolt.className = 'storm-bolt';
    bolt.style.setProperty('--bolt-left', left);
    bolt.style.setProperty('--bolt-delay', delay);

    for (let i = 0; i < 5; i += 1) {
      const segment = document.createElement('span');
      segment.style.setProperty('--segment-index', i);
      bolt.append(segment);
    }

    return bolt;
  }

  function runLightning() {
    if (motionQuery?.matches || (!isHomePage && getSessionFlag(seenKey))) return;

    const overlay = document.createElement('div');
    overlay.className = 'storm-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.append(createBolt('72%', '0s'));
    overlay.append(createBolt('36%', '.34s'));
    document.body.append(overlay);
    if (!isHomePage) setSessionFlag(seenKey);

    window.setTimeout(() => overlay.remove(), 2300);
  }

  function buildNoiseBuffer(context, duration) {
    const sampleCount = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;

    for (let i = 0; i < sampleCount; i += 1) {
      const progress = i / sampleCount;
      const envelope = Math.pow(1 - progress, 2.4);
      last = (last * 0.86) + ((Math.random() * 2 - 1) * 0.14);
      data[i] = last * envelope;
    }

    return buffer;
  }

  function playThunder() {
    if (!AudioContextCtor || (!isHomePage && getSessionFlag(thunderKey))) return Promise.resolve(false);

    const context = new AudioContextCtor();
    const startSound = () => {
      const now = context.currentTime;
      const master = context.createGain();
      const lowpass = context.createBiquadFilter();
      const rumble = context.createOscillator();
      const rumbleGain = context.createGain();
      const noise = context.createBufferSource();

      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.42, now + 0.08);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 2.35);

      lowpass.type = 'lowpass';
      lowpass.frequency.setValueAtTime(520, now);
      lowpass.frequency.exponentialRampToValueAtTime(85, now + 2.1);
      lowpass.Q.setValueAtTime(0.8, now);

      noise.buffer = buildNoiseBuffer(context, 2.45);
      noise.connect(lowpass);
      lowpass.connect(master);

      rumble.type = 'sine';
      rumble.frequency.setValueAtTime(58, now);
      rumble.frequency.exponentialRampToValueAtTime(31, now + 2.2);
      rumbleGain.gain.setValueAtTime(0.0001, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.28, now + 0.16);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
      rumble.connect(rumbleGain);
      rumbleGain.connect(master);

      master.connect(context.destination);
      noise.start(now);
      noise.stop(now + 2.45);
      rumble.start(now);
      rumble.stop(now + 2.25);
      if (!isHomePage) setSessionFlag(thunderKey);
      window.setTimeout(() => context.close?.(), 2800);
      return true;
    };

    if (context.state === 'running') return Promise.resolve(startSound());

    return context.resume().then(() => {
      if (context.state !== 'running') throw new Error('Audio is blocked');
      return startSound();
    });
  }

  function armGestureFallback() {
    const options = { once: true, passive: true };
    const playAfterGesture = () => {
      playThunder().catch(() => {});
    };

    document.addEventListener('pointerdown', playAfterGesture, options);
    document.addEventListener('touchstart', playAfterGesture, options);
    document.addEventListener('keydown', playAfterGesture, { once: true });
  }

  function startStorm() {
    runLightning();
    if (!isHomePage && getSessionFlag(thunderKey)) return;

    window.setTimeout(() => {
      const thunderAttempt = playThunder();
      const blockedTimer = window.setTimeout(armGestureFallback, 450);
      thunderAttempt
        .then((played) => {
          window.clearTimeout(blockedTimer);
          if (!played) armGestureFallback();
        })
        .catch(() => {
          window.clearTimeout(blockedTimer);
          armGestureFallback();
        });
    }, 180);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startStorm, { once: true });
  } else {
    startStorm();
  }
}());
