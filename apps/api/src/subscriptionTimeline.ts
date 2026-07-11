import type { SubscriptionMonths } from "@opengym/shared";

const DAY_MS = 86_400_000;

export interface SubscriptionTimelineRecord {
  id: string;
  userId: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}

export interface SubscriptionTimelineRepair {
  id: string;
  startsAt: Date;
  endsAt: Date;
}

export interface SubscriptionPeriod {
  startsAt: Date;
  endsAt: Date;
}

export interface SubscriptionSummary {
  active: boolean;
  endsAt: Date | null;
  remainingDays: number;
}

/**
 * Bir tarihe UTC takvim ayı ekler. Hedef ayda kaynak gün yoksa ayın
 * son gününe sıkıştırır (31 Ocak + 1 ay = 28/29 Şubat).
 */
export function addUtcCalendarMonthsClamped(
  date: Date,
  months: SubscriptionMonths,
): Date {
  const targetMonthIndex = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();

  const result = new Date(date.getTime());
  result.setUTCFullYear(
    targetYear,
    targetMonth,
    Math.min(date.getUTCDate(), lastDayOfTargetMonth),
  );
  return result;
}

/** Yeni paketi son aboneliğin sonundan, abonelik bitmişse şimdiden başlatır. */
export function calculateSubscriptionPeriod(
  now: Date,
  latestEndsAt: Date | null,
  months: SubscriptionMonths,
): SubscriptionPeriod {
  const startsAt = new Date(
    Math.max(
      now.getTime(),
      latestEndsAt?.getTime() ?? Number.NEGATIVE_INFINITY,
    ),
  );
  return {
    startsAt,
    endsAt: addUtcCalendarMonthsClamped(startsAt, months),
  };
}

/**
 * Eski kayıtları oluşturulma sırasında tek bir zaman çizelgesine dizer.
 * İlk kayıt korunur; sonraki bir kayıt öncekiyle çakışıyorsa kendi
 * milisaniye süresi değişmeden önceki kaydın bitişine taşınır.
 */
export function planLegacySubscriptionRepairs(
  records: readonly SubscriptionTimelineRecord[],
): SubscriptionTimelineRepair[] {
  const sorted = [...records].sort((left, right) => {
    const userOrder = left.userId.localeCompare(right.userId);
    if (userOrder !== 0) return userOrder;
    const createdOrder = left.createdAt.getTime() - right.createdAt.getTime();
    return createdOrder !== 0 ? createdOrder : left.id.localeCompare(right.id);
  });

  const repairs: SubscriptionTimelineRepair[] = [];
  let previousUserId: string | null = null;
  let previousEndsAt: Date | null = null;

  for (const record of sorted) {
    const durationMs = record.endsAt.getTime() - record.startsAt.getTime();
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new RangeError(`Geçersiz abonelik süresi: ${record.id}`);
    }

    if (record.userId !== previousUserId) {
      previousUserId = record.userId;
      previousEndsAt = new Date(record.endsAt.getTime());
      continue;
    }

    if (record.startsAt.getTime() < previousEndsAt!.getTime()) {
      const startsAt: Date = new Date(previousEndsAt!.getTime());
      const endsAt: Date = new Date(startsAt.getTime() + durationMs);
      repairs.push({ id: record.id, startsAt, endsAt });
      previousEndsAt = endsAt;
      continue;
    }

    previousEndsAt = new Date(record.endsAt.getTime());
  }

  return repairs;
}

/** Aktif aralığı ve ona bitişik gelecek paketleri tek bir bitişe toplar. */
export function summarizeSubscriptionTimeline(
  records: readonly Pick<SubscriptionTimelineRecord, "startsAt" | "endsAt">[],
  now: Date,
): SubscriptionSummary {
  const sorted = [...records].sort(
    (left, right) =>
      left.startsAt.getTime() - right.startsAt.getTime() ||
      left.endsAt.getTime() - right.endsAt.getTime(),
  );
  let entitlementEndsAt: Date | null = null;

  for (const record of sorted) {
    if (entitlementEndsAt === null) {
      if (record.startsAt <= now && record.endsAt >= now) {
        entitlementEndsAt = new Date(record.endsAt.getTime());
      }
      continue;
    }

    if (record.startsAt.getTime() > entitlementEndsAt.getTime()) break;
    if (record.endsAt.getTime() > entitlementEndsAt.getTime()) {
      entitlementEndsAt = new Date(record.endsAt.getTime());
    }
  }

  if (entitlementEndsAt === null) {
    return { active: false, endsAt: null, remainingDays: 0 };
  }

  return {
    active: true,
    endsAt: entitlementEndsAt,
    remainingDays: Math.max(
      0,
      Math.ceil((entitlementEndsAt.getTime() - now.getTime()) / DAY_MS),
    ),
  };
}
