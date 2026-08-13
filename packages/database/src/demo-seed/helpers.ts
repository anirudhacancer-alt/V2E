export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function sortBySeed<T>(
  items: readonly T[],
  seed: string,
  getId: (item: T) => string
): T[] {
  return [...items].sort((left, right) => {
    const leftKey = hashString(`${seed}:${getId(left)}`);
    const rightKey = hashString(`${seed}:${getId(right)}`);
    if (leftKey !== rightKey) {
      return leftKey - rightKey;
    }
    return getId(left).localeCompare(getId(right));
  });
}

export function offsetFromHash(
  seed: string,
  id: string,
  min: number,
  max: number
): number {
  const span = max - min + 1;
  if (span <= 0) {
    return min;
  }
  return min + (hashString(`${seed}:${id}`) % span);
}

export function allocateCounts<T extends string>(
  total: number,
  weights: Record<T, number>
): Record<T, number> {
  const entries = Object.entries(weights) as Array<[T, number]>;
  const positive = entries.filter(([, weight]) => weight > 0);
  const result = Object.fromEntries(
    entries.map(([key]) => [key, 0])
  ) as Record<T, number>;

  if (total <= 0 || positive.length === 0) {
    return result;
  }

  const weightSum = positive.reduce((sum, [, weight]) => sum + weight, 0);
  const provisional = positive.map(([key, weight]) => {
    const exact = (total * weight) / weightSum;
    const whole = Math.floor(exact);
    return {
      key,
      whole,
      fraction: exact - whole,
    };
  });

  let assigned = 0;
  for (const row of provisional) {
    result[row.key] = row.whole;
    assigned += row.whole;
  }

  let remaining = total - assigned;
  provisional
    .sort((left, right) => {
      if (left.fraction !== right.fraction) {
        return right.fraction - left.fraction;
      }
      return String(left.key).localeCompare(String(right.key));
    })
    .forEach((row, index) => {
      if (index < remaining) {
        result[row.key] += 1;
      }
    });

  remaining =
    total -
    (Object.values(result) as number[]).reduce(
      (sum: number, value: number) => sum + value,
      0
    );
  if (remaining > 0) {
    result[provisional[0].key] += remaining;
  }

  return result;
}

export function expandCounts<T extends string>(
  counts: Record<T, number>,
  order: readonly T[]
): T[] {
  const items: T[] = [];
  for (const key of order) {
    for (let i = 0; i < counts[key]; i += 1) {
      items.push(key);
    }
  }
  return items;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export function withUtcTime(date: Date, hour: number, minute = 0): Date {
  const next = startOfUtcDay(date);
  next.setUTCHours(hour, minute, 0, 0);
  return next;
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function addUtcMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addUtcHours(date: Date, hours: number): Date {
  return addUtcMinutes(date, hours * 60);
}

export function toIso(date: Date): string {
  return date.toISOString();
}

export function weekdayIndex(date: Date): number {
  const day = startOfUtcDay(date).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export function isBusinessDay(date: Date): boolean {
  return weekdayIndex(date) <= 4;
}

export function addBusinessDays(date: Date, days: number): Date {
  let current = startOfUtcDay(date);
  if (days === 0) {
    return current;
  }

  const step = days > 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    current = addUtcDays(current, step);
    if (isBusinessDay(current)) {
      remaining -= 1;
    }
  }
  return current;
}

export function startOfWeekUtc(date: Date): Date {
  return addUtcDays(startOfUtcDay(date), -weekdayIndex(date));
}

export function businessDaysRemainingInWeek(date: Date): number {
  const index = weekdayIndex(date);
  return index > 4 ? 0 : 5 - index;
}

export function businessDayProgress(date: Date): number {
  const index = weekdayIndex(date);
  return clamp(Math.min(index, 4) / 4, 0, 1);
}

export function differenceInUtcDays(later: Date, earlier: Date): number {
  const laterDay = startOfUtcDay(later).getTime();
  const earlierDay = startOfUtcDay(earlier).getTime();
  return Math.round((laterDay - earlierDay) / 86_400_000);
}

export function maxDate(left: Date, right: Date): Date {
  return left.getTime() >= right.getTime() ? left : right;
}
