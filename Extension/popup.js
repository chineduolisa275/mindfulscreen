// MINDFULSCREEN POPUP DASHBOARD
// Reads real browsing data from chrome.storage and renders it

var DAILY_LIMIT_MS = 7 * 60 * 60 * 1000;
var SITE_WARNING_MS = 30 * 60 * 1000;
var CAT_COLORS = {"Social Media":"#ef4444","Streaming":"#f97316","News":"#3b82f6","Shopping":"#a855f7","Productivity":"#22c55e","Education":"#06b6d4","Gaming":"#ec4899","Other":"#6b7280"};
var CAT_ICONS = {"Social Media":"👥","Streaming":"🎬","News":"📰","Shopping":"🛒","Productivity":"💼","Education":"📚","Gaming":"🎮","Other":"🌐"};
var currentTab = "sites";

function getTodayKey() { return new Date().toISOString().split("T")[0]; }
function fmtMs(ms) { var m = Math.floor(ms/60000), h = Math.floor(m/60), r = m%60; return h > 0 ? h+"h "+r+"m" : r+"m"; }
function fmtMin(m) { var h = Math.floor(m/60), r = m%60; return h > 0 ? h+"h "+r+"m" : r+"m"; }

async function getData() {
  var key = getTodayKey();
  var result = await chrome.storage.local.get(key);
  return result[key] || { sites: {}, totalMs: 0, warnings: [], breaks: 0 };
}

function getLevel(ms) {
  var pct = (ms / DAILY_LIMIT_MS) * 100;
  if (pct < 50) return "healthy";
  if (pct < 75) return "caution";
  if (pct < 100) return "warning";
  return "critical";
}

function renderBadge(level) {
  var labels = { healthy: "Healthy", caution: "Caution", warning: "High Usage", critical: "Over Limit" };
  return '<span class="badge badge-' + level + '"><span class="badge-dot"></span>' + labels[level] + '</span>';
}

function renderRing(totalMs) {
  var pct = Math.min((totalMs / DAILY_LIMIT_MS) * 100, 100);
  var level = getLevel(totalMs);
  var colors = { healthy: "#22c55e", caution: "#f59e0b", warning: "#f97316", critical: "#ef4444" };
  var color = colors[level];
  var r = 50, c = 2 * Math.PI * r, o = c - (pct / 100) * c;
  return '<div class="ring-label">Today\'s Screen Time</div>' +
    '<div class="ring-container">' +
    '<svg width="120" height="120" style="transform:rotate(-90deg)">' +
    '<circle cx="60" cy="60" r="'+r+'" fill="none" stroke="#dcfce7" stroke-width="10"/>' +
    '<circle cx="60" cy="60" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="10" stroke-dasharray="'+c+'" stroke-dashoffset="'+o+'" stroke-linecap="round" style="transition:stroke-dashoffset .8s"/>' +
    '</svg><div class="ring-text"><span class="ring-time">'+fmtMs(totalMs)+'</span><span class="ring-limit">of 7h limit</span></div></div>' +
    '<div class="ring-percent">'+Math.round(pct)+'% of daily limit</div>';
}

function renderTabs() {
  var tabs = [{id:"sites",i:"🌐",l:"Sites"},{id:"stats",i:"📊",l:"Stats"},{id:"reengagement",i:"🔄",l:"Re-engagement"}];
  return tabs.map(function(t) {
    return '<div class="tab '+(currentTab===t.id?'active':'')+'" data-tab="'+t.id+'">'+t.i+' '+t.l+'</div>';
  }).join("");
}

function renderSites(data) {
  var sites = Object.values(data.sites).sort(function(a,b){return b.totalMs-a.totalMs;});
  if (sites.length === 0) return '<div class="empty">No browsing data yet. Start browsing and check back!</div>';
  var html = '<div class="card">';
  sites.forEach(function(s) {
    var min = Math.floor(s.totalMs/60000);
    var over = s.totalMs >= SITE_WARNING_MS;
    var pct = data.totalMs > 0 ? ((s.totalMs/data.totalMs)*100).toFixed(1) : "0";
    var col = CAT_COLORS[s.category]||"#6b7280";
    var ico = CAT_ICONS[s.category]||"🌐";
    html += '<div class="site-row"><div class="site-icon" style="background:'+col+'15">'+ico+'</div>' +
      '<div class="site-info"><div class="site-name">'+s.domain+(over?'<span class="over-badge">⚠️ Over 30m</span>':'')+'</div>' +
      '<div class="site-meta"><span class="site-cat" style="border-left:2px solid '+col+'">'+s.category+'</span>' +
      '<span>'+s.visits+' visits</span><span>Last: '+s.lastVisit+'</span></div>' +
      '<div class="site-bar"><div class="site-bar-fill" style="width:'+pct+'%;background:'+col+'"></div></div></div>' +
      '<div class="site-time"><div class="site-minutes'+(over?' over':'')+'">'+fmtMin(min)+'</div>' +
      '<div class="site-pct">'+pct+'%</div></div></div>';
  });
  return html + '</div>';
}

function renderStats(data) {
  var sites = Object.values(data.sites);
  var tv = sites.reduce(function(s,x){return s+x.visits;},0);
  var cats = {};
  sites.forEach(function(s){cats[s.category]=(cats[s.category]||0)+s.totalMs;});
  var sorted = Object.entries(cats).sort(function(a,b){return b[1]-a[1];});
  var top = sorted.length > 0 ? sorted[0] : null;
  var tw = data.warnings ? data.warnings.length : 0;

  var html = '<div class="card"><div class="card-title">📊 Quick Stats</div>' +
    '<div class="stat-row"><span class="stat-label">🌐 Sites Visited</span><span class="stat-value">'+sites.length+'</span></div>' +
    '<div class="stat-row"><span class="stat-label">👆 Total Visits</span><span class="stat-value">'+tv+'</span></div>' +
    '<div class="stat-row"><span class="stat-label">'+(top?(CAT_ICONS[top[0]]||"📁"):"📁")+' Top Category</span><span class="stat-value">'+(top?top[0]:"N/A")+'</span></div>' +
    '<div class="stat-row"><span class="stat-label">⚠️ Warnings</span><span class="stat-value">'+tw+'</span></div>' +
    '<div class="stat-row"><span class="stat-label">☕ Breaks</span><span class="stat-value">'+(data.breaks||0)+'</span></div></div>';

  html += '<div class="card"><div class="card-title">📋 Time by Category</div>';
  sorted.forEach(function(e) {
    html += '<div class="stat-row"><span class="stat-label">'+(CAT_ICONS[e[0]]||"🌐")+' '+e[0]+'</span><span class="stat-value">'+fmtMs(e[1])+'</span></div>';
  });
  return html + '</div>';
}

function renderRE(data) {
  var sites = Object.values(data.sites).filter(function(s){return s.warningsSent>0;});
  if (sites.length === 0) return '<div class="empty">No warnings triggered yet. Data appears after 30 min on a site.</div>';
  var tw = sites.reduce(function(s,x){return s+x.warningsSent;},0);
  var tb = sites.reduce(function(s,x){return s+x.brokeAfterWarning;},0);
  var or = tw > 0 ? Math.round((tb/tw)*100) : 0;

  var html = '<div class="card"><div class="card-title">🔄 Re-engagement After Warnings</div>';
  sites.forEach(function(s) {
    var rate = s.warningsSent > 0 ? Math.round((s.brokeAfterWarning/s.warningsSent)*100) : 0;
    var cp = s.warningsSent > 0 ? (s.continuedAfterWarning/s.warningsSent)*100 : 0;
    var bp = s.warningsSent > 0 ? (s.brokeAfterWarning/s.warningsSent)*100 : 0;
    html += '<div class="re-site"><div class="re-header"><span class="re-name">'+s.domain+'</span>' +
      '<span class="re-rate '+(rate>=50?"good":"bad")+'">'+rate+'% break rate</span></div>' +
      '<div class="re-bars"><div class="re-bar-group">' +
      '<div class="re-bar-label"><span>Continued</span><span>'+s.continuedAfterWarning+'</span></div>' +
      '<div class="re-bar-track"><div class="re-bar-fill re-bar-red" style="width:'+cp+'%"></div></div></div>' +
      '<div class="re-bar-group">' +
      '<div class="re-bar-label"><span>Took break</span><span>'+s.brokeAfterWarning+'</span></div>' +
      '<div class="re-bar-track"><div class="re-bar-fill re-bar-green" style="width:'+bp+'%"></div></div></div></div></div>';
  });

  html += '<div class="summary-box"><div class="summary-title">📊 Overall Summary</div>' +
    '<div class="summary-grid">' +
    '<div><div class="summary-num">'+tw+'</div><div class="summary-label">Warnings</div></div>' +
    '<div><div class="summary-num">'+or+'%</div><div class="summary-label">Break Rate</div></div>' +
    '<div><div class="summary-num">'+tb+'</div><div class="summary-label">Breaks</div></div>' +
    '</div></div></div>';
  return html;
}

async function render() {
  var data = await getData();
  var level = getLevel(data.totalMs);
  document.getElementById("logo").className = level === "critical" ? "logo critical" : "logo";
  document.getElementById("status-badge").innerHTML = renderBadge(level);
  document.getElementById("ring-section").innerHTML = renderRing(data.totalMs);
  document.getElementById("tabs").innerHTML = renderTabs();
  var content = document.getElementById("content");
  if (currentTab === "sites") content.innerHTML = renderSites(data);
  else if (currentTab === "stats") content.innerHTML = renderStats(data);
  else if (currentTab === "reengagement") content.innerHTML = renderRE(data);
  document.querySelectorAll(".tab").forEach(function(tab) {
    tab.addEventListener("click", function() { currentTab = tab.dataset.tab; render(); });
  });
}

render();
setInterval(render, 5000);
