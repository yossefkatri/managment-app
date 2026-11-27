// Cyclic (recurring) incomes and expenses.
//
// Only the rule is stored (locally and in Drive):
//   { id, type, amount, description, category, dayOfMonth, startMonth: 'YYYY-MM', endMonth: 'YYYY-MM' | null }
// The monthly occurrences are never stored - they are generated from the rules whenever they are displayed.

const pad = (n) => String(n).padStart(2, '0')

/** 'YYYY-MM' of a Date. */
export const toYm = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`

/** The month after `ym`. */
const nextMonth = (ym) => toYm(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 1))

/** Number of days in the month `ym`. */
const daysInMonth = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()

/**
 * Date of the rule's occurrence in `ym`. A day that doesn't exist in that month
 * (e.g. the 31st in February) moves to the month's last day.
 */
export const occurrenceDate = (dayOfMonth, ym) => `${ym}-${pad(Math.min(dayOfMonth, daysInMonth(ym)))}`

/** True when the rule produces an occurrence in month `ym`. */
export const isActiveIn = (rule, ym) => rule.startMonth <= ym && (!rule.endMonth || ym <= rule.endMonth)

/**
 * Generates the occurrences of every rule for the months `fromMonth`..`toMonth` (inclusive).
 * Each occurrence looks like a normal transaction, plus `cyclicId` pointing back at its rule.
 * Its id is derived from the rule and the month, so it stays the same across renders.
 */
export function expandCyclic(rules, fromMonth, toMonth) {
  const result = []
  for (const rule of rules) {
    const first = rule.startMonth > fromMonth ? rule.startMonth : fromMonth
    const last = rule.endMonth && rule.endMonth < toMonth ? rule.endMonth : toMonth
    for (let ym = first; ym <= last; ym = nextMonth(ym)) {
      result.push({
        id: `cyclic-${rule.id}-${ym}`,
        cyclicId: rule.id,
        type: rule.type,
        amount: rule.amount,
        description: rule.description,
        category: rule.category,
        date: occurrenceDate(rule.dayOfMonth, ym),
      })
    }
  }
  return result
}

/** The earliest start month among the rules, or null when there are none. */
export const firstCyclicMonth = (rules) =>
  rules.reduce((min, r) => (min === null || r.startMonth < min ? r.startMonth : min), null)

/**
 * Merges this device's rules into the cloud copy, the same way mergeTransactions does for
 * transactions: a rule with the same id already in the cloud keeps the cloud version.
 */
export function mergeCyclic(cloud, local) {
  const ids = new Set(cloud.map((r) => r.id))
  const added = local.filter((r) => !ids.has(r.id))
  return { merged: [...cloud, ...added], addedCount: added.length }
}
