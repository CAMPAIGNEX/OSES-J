---
title: Clients & CRM
section: Clients & CRM
order: 1
summary: Saved leads, Add to Business, permanent CIDs, duplicate protection, tags, notes, timeline and trash.
updated: 2026-09-14
---

## Saved leads

**Saved Leads** is your shortlist. Save from search results, or unsave from here. Columns can be sorted by score, followers, added date and status. Bulk actions: Add to Business, Tag, Export, Delete.

## Add to Business

Select leads and click **Add to Business**. For each lead OSES J:

1. Checks for an existing client with the same profile, website, email or phone. If one exists you get that client back (no duplicate).
2. Allocates the next **CID** in your workspace: `CX-000001`, `CX-000002`, and so on.
3. Copies the profile, social accounts, contacts (with sources) and notes.
4. Sets status **New** and writes an activity.

CIDs are permanent: they are never reused, even after a client is permanently deleted.

You can also create a client manually from **Clients → New client** (brand, website, email, phone, Instagram/Facebook handles). Duplicate detection runs there too.

## The client profile

- **Header**: brand, CID, status, tags, eligibility per channel.
- **Contacts**: every email, phone, WhatsApp, website with source and confidence. Add or edit manually; manual entries are marked `MANUAL`.
- **Social accounts**: platform, handle, followers, messaging eligibility (`Discovered`, `Messageable`, `Not messageable`, `Requires user`, `Provider error`) and the reason.
- **Timeline**: searches, enrichment, messages, AI actions, status changes, notes.
- **Notes**: free text with author and time.
- **Documents**: attached catalogues and files.
- **Actions**: AI first message, open inbox, enrich from website, re-check eligibility, mark do-not-contact, move to trash.

## Statuses

`New → Contacted → Replied → Interested → Negotiating → Customer`, plus `Not interested`, `Do not contact` and `Archived`. Statuses update automatically from messaging events (first message sent, reply received, intent classified) and can be changed manually.

## Do-not-contact

Marking a client *do-not-contact* blocks every send (manual or automatic) at the service level, cancels scheduled messages and is respected by campaigns and the AI. Opt-out replies detected by the AI set it automatically.

## Tags

Create tags with colours in **Clients → Tags** and apply them to leads and clients. Filter lists and build campaign audiences by tag.

## Trash

Deleted leads, clients, documents and messages go to **Trash** for 7 days. Restore with one click; after 7 days a scheduled job purges them permanently. CIDs of purged clients remain reserved.

## Export

Any list (leads, saved leads, clients, search results) exports to XLSX with the visible columns plus contacts and sources.
