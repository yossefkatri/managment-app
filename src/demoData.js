// Demo transactions for the 3 months before the current month.
// Every demo transaction carries `demo: true` so it can be removed in one click.

const TEMPLATE = [
  // [day, type, amount, category, description]
  [1, 'income', 14500, 'משכורת', 'משכורת חודשית'],
  [2, 'expense', 4800, 'דיור', 'שכר דירה'],
  [5, 'expense', 650, 'חשבונות', 'חשמל ומים'],
  [8, 'expense', 1200, 'אוכל', 'סופר'],
  [12, 'expense', 380, 'תחבורה', 'רב-קו'],
  [15, 'expense', 450, 'בילויים', 'מסעדה'],
  [19, 'expense', 900, 'קניות', 'בגדים'],
  [22, 'expense', 1050, 'אוכל', 'סופר'],
  [26, 'expense', 250, 'בריאות', 'בית מרקחת'],
]

// Per-month tweaks so the three months look different on the chart
const VARIATIONS = [
  { extraIncome: 0, expenseFactor: 1.15, extra: [10, 'expense', 2300, 'קניות', 'מכונת כביסה'] },
  { extraIncome: 3200, expenseFactor: 0.95, extra: [17, 'income', 3200, 'עבודה נוספת', 'פרויקט פרילנס'] },
  { extraIncome: 0, expenseFactor: 1.05, extra: [24, 'expense', 1600, 'בילויים', 'חופשה בצפון'] },
]

const pad = (n) => String(n).padStart(2, '0')

export function createDemoTransactions(now = new Date()) {
  const result = []
  VARIATIONS.forEach((variation, i) => {
    // i = 0 -> 3 months ago, i = 2 -> last month
    const d = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1)
    const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
    const rows = [...TEMPLATE, variation.extra]
    rows.forEach(([day, type, amount, category, description], j) => {
      result.push({
        id: `demo-${ym}-${j}`,
        type,
        amount: type === 'expense' ? Math.round(amount * variation.expenseFactor) : amount,
        description,
        category,
        date: `${ym}-${pad(day)}`,
        demo: true,
      })
    })
  })
  return result
}
