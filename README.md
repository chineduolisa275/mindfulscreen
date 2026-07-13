# MindfulScreen — Browser Activity Monitoring Extension

A lightweight Chrome extension that monitors browsing activity in real time. It's the companion monitoring tool for the [Digital Well-being Intelligence System](https://github.com/chineduolisa275/Digital-overconsumption-system) — feeding real usage data into that platform's analysis and recommendations.

## What it does

- Tracks which sites are visited and how long is spent on them, in real time.
- Runs quietly in the background while you browse.
- Sends activity data to the Digital Well-being platform, where it's analysed to spot patterns and trigger evidence-based prompts.

## Tech

- **Chrome Extension (Manifest V3)**
- **Background service worker** — handles tracking and messaging.
- **Content script** — reads page activity.
- **Popup interface** — shows the user their current activity at a glance.

## How to install (developer mode)

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the **Extension** folder.
5. The MindfulScreen icon will appear in your toolbar.

## Part of a larger project

This extension is one component of a full-stack digital well-being platform (React, Node/Express, MongoDB, sentiment analysis and a recommendation engine). See the main project here: [Digital Well-being Intelligence System](https://github.com/chineduolisa275/Digital-overconsumption-system).

---

*Built by Chinedu Olisa.*
