/**
 * Development seed: creates a demo exporter organization with an owner account.
 * Run with `pnpm db:seed`. Safe to re-run (idempotent).
 *
 *   email:    demo@oses-j.local
 *   password: DemoPass123!
 */
import path from "node:path";
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: path.resolve(import.meta.dirname, "../../../.env") });

import { hashPassword } from "@oses/shared";
import { disconnectDb, getDb } from "./client";

async function main(): Promise<void> {
  const db = getDb();
  const email = "demo@oses-j.local";
  const passwordHash = await hashPassword("DemoPass123!");
  const user = await db.user.upsert({ where: { email }, create: { email, name: "Demo Exporter", passwordHash, timezone: "Asia/Karachi" }, update: { passwordHash } });
  const slug = "abc-sportswear";
  const org = await db.organization.upsert({
    where: { slug },
    create: {
      name: "ABC Sportswear",
      slug,
      description: "Manufacturer and exporter of custom and private-label sportswear, gym wear and hoodies.",
      country: "Pakistan",
      city: "Sialkot",
      products: "Custom sportswear, hoodies, tracksuits, gym wear, jerseys, t-shirts",
      moq: "500 units per style (mixed sizes allowed)",
      shippingInfo: "Sea and air freight worldwide; DDP quotes available on request",
      timezone: "Asia/Karachi",
    },
    update: {},
  });
  await db.organizationMember.upsert({ where: { organizationId_userId: { organizationId: org.id, userId: user.id } }, create: { organizationId: org.id, userId: user.id, role: "OWNER" }, update: { role: "OWNER" } });
  await db.organizationCounter.upsert({ where: { organizationId_key: { organizationId: org.id, key: "client_cid" } }, create: { organizationId: org.id, key: "client_cid", value: 0 }, update: {} });
  await db.organizationSettings.upsert({ where: { organizationId: org.id }, create: { organizationId: org.id, followUpDays: [3, 7, 14], workingHours: { enabled: false, start: "10:00", end: "17:00", days: [1, 2, 3, 4, 5], timezoneMode: "client" } }, update: {} });
  const instructions = [
    { kind: "TONE" as const, title: "Tone of voice", content: "Professional, friendly and short. Write like an experienced B2B sales manager, not a marketer. One clear question at the end." },
    { kind: "PROHIBITED" as const, title: "Never do this", content: "Never promise delivery dates.\nNever invent certifications.\nNever quote prices without approval.\nNever claim an existing relationship.\nNever mention scraping or data collection." },
    { kind: "ESCALATION" as const, title: "Escalate to a human", content: "Pricing negotiation, legal or contract questions, complaints, refunds and sample requests with custom technical specifications must be escalated to the sales team." },
  ];
  for (const i of instructions) {
    const exists = await db.aIInstruction.findFirst({ where: { organizationId: org.id, title: i.title } });
    if (!exists) await db.aIInstruction.create({ data: { organizationId: org.id, ...i } });
  }
  console.log(`Seeded organization "${org.name}" with user ${email} / DemoPass123!`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
