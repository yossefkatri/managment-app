// Shared formatting helpers and constants.

export const CATEGORIES = {
  income: ['משכורת', 'עבודה נוספת', 'מתנה', 'אחר'],
  expense: ['אוכל', 'דיור', 'תחבורה', 'חשבונות', 'בילויים', 'קניות', 'בריאות', 'אחר'],
}

export const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })

/** Today as 'YYYY-MM-DD'. */
export const today = () => new Date().toISOString().slice(0, 10)

/** 'YYYY-MM' of a 'YYYY-MM-DD' date. */
export const monthOf = (date) => date.slice(0, 7)

const monthLongFormat = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' })
/** 'YYYY-MM' → e.g. "נובמבר 2026". */
export const monthName = (ym) => monthLongFormat.format(new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1))
