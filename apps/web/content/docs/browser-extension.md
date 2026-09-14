---
title: Browser extension
section: Integrations
order: 2
summary: Install and pair the Chrome extension that sends approved messages from your own Instagram and Facebook session.
updated: 2026-09-14
---

## What it is

A Chrome extension that runs in your own browser. When OSES J has a message to send automatically and you are logged in to Instagram or Facebook, the extension opens the profile, verifies the page, types the message, sends it and reports the result. It never sees your Instagram or Facebook password and never receives your OSES J password.

## Install

1. Download the extension package from your CNEX AI contact (or build it from the repository with `pnpm extension:build`).
2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the extension folder.

## Pair

1. In OSES J open **Settings → Automation → Pair extension**. A code appears (valid 10 minutes).
2. Click the extension icon, enter your OSES J address (for example `https://oses.cnexai.com`) and the code, then **Pair**. Chrome asks permission to contact your OSES J address; accept.
3. The popup shows *Connected*, the Instagram/Facebook login state and recent activity.

## Sending

Choose **Send automatically** in the composer. If the extension is online and you are logged in, the job is queued for it. Progress is visible on the message: opening target → target found → composer found → sending → sent.

The extension verifies every step: login page detected, profile not found, no Message button (private account or messaging disabled), restriction warnings ("Action blocked", "Try again later"), and finally that the text appears in the conversation. Any failed check stops with a precise reason and the message shows *Requires user* with a link to send it yourself.

## Controls

- **Pause / Resume** in the popup.
- **Disconnect** removes the pairing; disable devices in **Settings → Automation → Devices**.
- Turn the extension off for the whole workspace in **Settings → Automation**.

## Limits

Text messages only; one job at a time per device; Instagram/Facebook interface changes may require an extension update, in which case jobs fail safely with *composer not found* rather than sending blindly.
