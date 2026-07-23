import { prisma } from "@/lib/db";

const SETTINGS_ID = "singleton";

export async function getAppSettings() {
  return (
    (await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } })) ?? {
      id: SETTINGS_ID,
      referenceApy: null,
      nudgeSnoozedUntil: null,
    }
  );
}

export async function updateAppSettings(patch: {
  referenceApy?: number;
  nudgeSnoozedUntil?: Date;
}) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...patch },
    update: patch,
  });
}
