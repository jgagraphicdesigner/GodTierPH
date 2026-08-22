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
    closeNavGroups(group);
    setNavGroupOpen(group, true);
  });

  group.addEventListener('focusout', (event) => {
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
      closeNavGroups(navGroup);
      setNavGroupOpen(navGroup, !navGroup.classList.contains('open'));
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

const partyList = document.getElementById('partyList');
const partyListStatus = document.getElementById('partyListStatus');
const refreshPartyList = document.getElementById('refreshPartyList');
const leagueTabs = document.querySelectorAll('[data-league]');
const rosterCsvUrls = {
  main: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmWixlFa2eg6ORNNiO7YTGoWqjBoiuVjwxHQeKB1N8xu08sN_P-5hSQp8Kcm_y7Q/pub?gid=495643243&single=true&output=csv',
  sub: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmWixlFa2eg6ORNNiO7YTGoWqjBoiuVjwxHQeKB1N8xu08sN_P-5hSQp8Kcm_y7Q/pub?gid=1609318158&single=true&output=csv',
};
const leagueLabels = {
  main: 'Main League',
  sub: 'Sub League',
};
let activeLeague = 'main';

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
    const parties = partyColumns.map(({ cell, column }) => ({
      name: cell,
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
        const rowLabel = (memberRow[0] || '').toLowerCase();
        parties.forEach((party) => {
          const name = memberRow[party.nameColumn] || '';
          const job = memberRow[party.jobColumn] || '';
          if (name || job) {
            party.members.push({
              name: name || 'TBA',
              job: job || 'TBA',
              leader: rowLabel.includes('party leader'),
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
        item.append(textNode('span', 'member-job', member.leader ? `${member.job} - Lead` : member.job));
        members.append(item);
      });
      card.append(members);
      grid.append(card);
    });

    sectionNode.append(grid);
    partyList.append(sectionNode);
  });
}

async function loadPartyList() {
  if (!partyList) return;
  const leagueLabel = leagueLabels[activeLeague] || 'Party List';
  const rosterCsvUrl = rosterCsvUrls[activeLeague] || rosterCsvUrls.main;
  partyListStatus.textContent = `Updating ${leagueLabel}`;

  try {
    const response = await fetch(`${rosterCsvUrl}&cache=${Date.now()}`);
    if (!response.ok) throw new Error('Roster request failed');
    const csv = await response.text();
    const sections = parseRoster(parseCsv(csv));
    renderRoster(sections);
    partyListStatus.textContent = `${leagueLabel} updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } catch (error) {
    partyList.replaceChildren(textNode('div', 'error-row', 'Could not load the party list. Use the Open Party List button while Google refreshes the published sheet.'));
    partyListStatus.textContent = 'Roster unavailable';
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
  loadPartyList();
}

leagueTabs.forEach((tab) => {
  tab.addEventListener('click', () => setActiveLeague(tab.dataset.league));
});
refreshPartyList?.addEventListener('click', loadPartyList);
loadPartyList();
setInterval(loadPartyList, 5 * 60 * 1000);
