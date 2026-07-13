// ===== MINDFULSCREEN - BACKGROUND SERVICE WORKER =====
// Runs silently, tracks all browsing activity automatically.

// ----- Auto-categorisation -----
const SITE_CATEGORIES = {
  "Social Media": ["facebook.com","twitter.com","x.com","instagram.com","tiktok.com","snapchat.com","reddit.com","linkedin.com","threads.net"],
  "Streaming": ["youtube.com","netflix.com","twitch.tv","disneyplus.com","primevideo.com","spotify.com"],
  "News": ["bbc.co.uk","theguardian.com","cnn.com","reuters.com","dailymail.co.uk","news.google.com"],
  "Shopping": ["amazon.co.uk","amazon.com","ebay.com","ebay.co.uk","etsy.com","asos.com","argos.co.uk"],
  "Productivity": ["docs.google.com","notion.so","trello.com","github.com","stackoverflow.com","figma.com"],
  "Education": ["coursera.org","udemy.com","khanacademy.org","scholar.google.com","brunel.ac.uk","brightspace.brunel.ac.uk"],
  "Gaming": ["store.steampowered.com","discord.com","roblox.com","xbox.com"]
};

// ----- Thresholds -----
const DAILY_LIMIT_MS = 7 * 60 * 60 * 1000;   // 7 hours total
const SITE_WARNING_MS = 30 * 60 * 1000;       // 30 min per site

// ----- State -----
let currentTabId = null;
let currentDomain = null;
let lastTickTime = Date.now();

// ----- Helpers -----
function getDomain(url) {
  try { return new URL(url).hostname.replace("www.", ""); }
  catch { return null; }
}

function categoriseSite(domain) {
  for (const [cat, sites] of Object.entries(SITE_CATEGORIES)) {
    if (sites.some(s => domain.includes(s) || s.includes(domain))) return cat;
  }
  return "Other";
}

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

async function getTrackingData() {
  const key = getTodayKey();
  const result = await chrome.storage.local.get(key);
  return result[key] || { sites: {}, totalMs: 0, warnings: [], breaks: 0 };
}

async function saveTrackingData(data) {
  await chrome.storage.local.set({ [getTodayKey()]: data });
}

// ----- Core tracking (runs every ~6 seconds) -----
async function trackTime() {
  if (!currentDomain) return;

  const now = Date.now();
  const elapsed = now - lastTickTime;
  lastTickTime = now;

  // Skip if tab was probably inactive
  if (elapsed > 30000) return;

  const data = await getTrackingData();

  // Create site entry if new
  if (!data.sites[currentDomain]) {
    data.sites[currentDomain] = {
      domain: currentDomain,
      category: categoriseSite(currentDomain),
      totalMs: 0,
      visits: 1,
      lastVisit: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      warningsSent: 0,
      continuedAfterWarning: 0,
      brokeAfterWarning: 0
    };
  }

  const site = data.sites[currentDomain];
  site.totalMs += elapsed;
  site.lastVisit = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  data.totalMs += elapsed;

  // --- SITE WARNING at 30 min ---
  const warningsExpected = Math.floor(site.totalMs / SITE_WARNING_MS);
  if (site.warningsSent < warningsExpected) {
    site.warningsSent++;
    data.warnings.push({
      domain: currentDomain,
      time: new Date().toISOString(),
      type: "site_limit",
      minutes: Math.floor(site.totalMs / 60000)
    });
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: "SHOW_WARNING",
          warningType: "site",
          domain: currentDomain,
          minutes: Math.floor(site.totalMs / 60000),
          totalMinutes: Math.floor(data.totalMs / 60000)
        });
      }
    } catch (e) {}
  }

  // --- DAILY LIMIT at 7 hours ---
  if (data.totalMs >= DAILY_LIMIT_MS) {
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    chrome.action.setBadgeText({ text: "!" });

    const overWarnings = data.warnings.filter(w => w.type === "daily_limit").length;
    const expected = Math.floor((data.totalMs - DAILY_LIMIT_MS) / (30 * 60000)) + 1;
    if (overWarnings < expected) {
      data.warnings.push({
        domain: currentDomain,
        time: new Date().toISOString(),
        type: "daily_limit",
        totalMinutes: Math.floor(data.totalMs / 60000)
      });
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "SHOW_WARNING",
            warningType: "daily",
            domain: currentDomain,
            minutes: Math.floor(site.totalMs / 60000),
            totalMinutes: Math.floor(data.totalMs / 60000)
          });
        }
      } catch (e) {}
    }
  } else {
    // Show running total on badge icon
    const totalMin = Math.floor(data.totalMs / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    chrome.action.setBadgeText({ text: h > 0 ? `${h}h${m}` : `${m}m` });
    chrome.action.setBadgeBackgroundColor({ color: totalMin > 300 ? "#f97316" : "#6366f1" });
  }

  await saveTrackingData(data);
}

// ----- Tab listeners -----
chrome.tabs.onActivated.addListener(async (info) => {
  currentTabId = info.tabId;
  try {
    const tab = await chrome.tabs.get(info.tabId);
    const domain = getDomain(tab.url);
    if (domain && domain !== currentDomain) {
      currentDomain = domain;
      lastTickTime = Date.now();
      const data = await getTrackingData();
      if (data.sites[domain]) data.sites[domain].visits++;
      await saveTrackingData(data);
    }
  } catch (e) {}
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (tabId === currentTabId && changeInfo.url) {
    const domain = getDomain(changeInfo.url);
    if (domain && domain !== currentDomain) {
      currentDomain = domain;
      lastTickTime = Date.now();
      const data = await getTrackingData();
      if (!data.sites[domain]) {
        data.sites[domain] = {
          domain, category: categoriseSite(domain), totalMs: 0, visits: 1,
          lastVisit: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          warningsSent: 0, continuedAfterWarning: 0, brokeAfterWarning: 0
        };
      } else {
        data.sites[domain].visits++;
      }
      await saveTrackingData(data);
    }
  }
});

// ----- Idle detection -----
chrome.idle.onStateChanged.addListener((state) => {
  if (state === "idle" || state === "locked") {
    currentDomain = null;
  } else if (state === "active") {
    lastTickTime = Date.now();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) currentDomain = getDomain(tabs[0].url);
    });
  }
});

// ----- Warning responses from content script -----
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === "WARNING_RESPONSE") {
    const data = await getTrackingData();
    const site = data.sites[msg.domain];
    if (site) {
      if (msg.action === "break") {
        site.brokeAfterWarning++;
        data.breaks++;
      } else {
        site.continuedAfterWarning++;
      }
      await saveTrackingData(data);
    }
  }
});

// ----- Timer (runs trackTime every ~6 seconds) -----
chrome.alarms.create("trackTime", { periodInMinutes: 0.1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "trackTime") trackTime();
  if (alarm.name === "syncBackend") syncToBackend();
});

// ----- First install -----
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "0m" });
  chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
  console.log("MindfulScreen installed!");
});

// ===== BACKEND SYNC =====
// Sends browsing data to your Express server every 5 minutes

async function syncToBackend() {
  const data = await getTrackingData();
  const sites = Object.values(data.sites);

  // Only sync if there's actual data
  if (sites.length === 0) return;

  try {
    await fetch("http://localhost:5000/api/extension/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: getTodayKey(),
        totalMinutes: Math.floor(data.totalMs / 60000),
        sites: sites.map(function(s) {
          return {
            domain: s.domain,
            category: s.category,
            minutes: Math.floor(s.totalMs / 60000),
            visits: s.visits,
            warningsSent: s.warningsSent,
            continuedAfterWarning: s.continuedAfterWarning,
            brokeAfterWarning: s.brokeAfterWarning
          };
        }),
        warnings: data.warnings,
        breaks: data.breaks
      })
    });
    console.log("[MindfulScreen] Synced to backend");
  } catch (e) {
    console.log("[MindfulScreen] Backend offline, will retry:", e.message);
  }
}

// Sync every 5 minutes
chrome.alarms.create("syncBackend", { periodInMinutes: 5 });
