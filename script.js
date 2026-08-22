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

(function initOnlineUsersWidget() {
  if (document.getElementById('onlineUsersWidget')) return;

  const storagePrefix = 'godtierphPresence:';
  const sessionKey = 'godtierphPresenceSession';
  const ttl = 18000;
  const heartbeatDelay = 6000;
  const endpoint = window.GODTIERPH_PRESENCE_ENDPOINT || '';

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
