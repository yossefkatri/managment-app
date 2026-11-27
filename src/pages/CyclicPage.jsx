import { useState } from 'react'
import { Button, Card, H2, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui'
import CyclicForm from '../components/CyclicForm.jsx'
import SummaryCard from '../components/SummaryCard.jsx'
import { isActiveIn } from '../cyclic.js'
import { money, monthName, monthOf, today } from '../format.js'

/** When the rule applies, e.g. "בכל 10 לחודש · מנובמבר 2026 · עד ינואר 2027". */
function scheduleText(rule) {
  const parts = [`בכל ${rule.dayOfMonth} לחודש`, `מ${monthName(rule.startMonth)}`]
  if (rule.endMonth) parts.push(`עד ${monthName(rule.endMonth)}`)
  return parts.join(' · ')
}

function CyclicRow({ rule, currentMonth, onEdit, onStop, onResume, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isIncome = rule.type === 'income'
  const ended = Boolean(rule.endMonth) && rule.endMonth < currentMonth
  const notStarted = rule.startMonth > currentMonth

  return (
    <YStack paddingVertical="$3" gap="$2" opacity={ended ? 0.65 : 1}>
      <XStack alignItems="center" gap="$3">
        <YStack flex={1}>
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <SizableText fontWeight="600">{rule.description || rule.category}</SizableText>
            {notStarted && (
              <SizableText size="$1" color="$color-10">
                (טרם התחילה)
              </SizableText>
            )}
          </XStack>
          <SizableText size="$2" color="$color-10">
            {rule.category} · {scheduleText(rule)}
          </SizableText>
        </YStack>
        <SizableText theme={isIncome ? 'green' : 'red'} color="$color-10" fontWeight="700">
          {isIncome ? '+' : '−'}
          {money.format(rule.amount)}
        </SizableText>
      </XStack>

      {confirmDelete ? (
        <Card theme="red" padding="$3" gap="$2" borderWidth={1} borderColor="$border-color">
          <Paragraph size="$2">
            למחוק את התנועה הקבועה? היא תיעלם גם מכל החודשים הקודמים. כדי לשמור את ההיסטוריה – בחר "הפסק" במקום.
          </Paragraph>
          <XStack gap="$2">
            <Button size="sm" theme="red" onPress={() => onDelete(rule.id)}>
              מחק לצמיתות
            </Button>
            <Button size="sm" variant="outlined" onPress={() => setConfirmDelete(false)}>
              ביטול
            </Button>
          </XStack>
        </Card>
      ) : (
        <XStack gap="$2" flexWrap="wrap">
          <Button size="sm" variant="outlined" onPress={() => onEdit(rule.id)}>
            ✎ ערוך
          </Button>
          {rule.endMonth ? (
            <Button size="sm" variant="outlined" onPress={() => onResume(rule.id)}>
              ▶ חדש
            </Button>
          ) : (
            <Button size="sm" variant="outlined" onPress={() => onStop(rule.id)}>
              ⏸ הפסק מהחודש הבא
            </Button>
          )}
          <Button size="sm" variant="outlined" theme="red" onPress={() => setConfirmDelete(true)}>
            🗑 מחק
          </Button>
        </XStack>
      )}
    </YStack>
  )
}

function RuleList({ title, rules, emptyText, ...rowProps }) {
  return (
    <Card padding="$4" borderWidth={1} borderColor="$border-color">
      <SizableText size="$5" fontWeight="700">
        {title}
      </SizableText>
      {rules.length === 0 ? (
        <Paragraph color="$color-10" marginTop="$2">
          {emptyText}
        </Paragraph>
      ) : (
        rules.map((rule, i) => (
          <YStack key={rule.id}>
            {i > 0 && <Separator />}
            <CyclicRow rule={rule} {...rowProps} />
          </YStack>
        ))
      )}
    </Card>
  )
}

/** Manage the cyclic (fixed monthly) incomes and expenses. */
export default function CyclicPage({ rules, onAdd, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const currentMonth = monthOf(today())
  const editing = rules.find((r) => r.id === editingId)

  // Totals of the rules that apply this month
  const activeNow = rules.filter((r) => isActiveIn(r, currentMonth))
  const income = activeNow.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0)
  const expense = activeNow.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0)

  // Incomes first, then expenses; each by day of the month
  const order = (a, b) => b.type.localeCompare(a.type) || a.dayOfMonth - b.dayOfMonth
  const isEnded = (r) => Boolean(r.endMonth) && r.endMonth < currentMonth
  const ongoing = rules.filter((r) => !isEnded(r)).sort(order)
  const ended = rules.filter(isEnded).sort(order)

  const ruleById = (id) => rules.find((r) => r.id === id)
  const rowProps = {
    currentMonth,
    onEdit: setEditingId,
    // Stopping keeps the rule (and its past months) and ends it after this month
    onStop: (id) => onUpdate({ ...ruleById(id), endMonth: currentMonth }),
    onResume: (id) => onUpdate({ ...ruleById(id), endMonth: null }),
    onDelete: (id) => {
      if (id === editingId) setEditingId(null)
      onDelete(id)
    },
  }

  return (
    <YStack gap="$4">
      <YStack gap="$1">
        <H2 size="$8">תנועות קבועות</H2>
        <Paragraph color="$color-10">
          הכנסות והוצאות שחוזרות כל חודש באותו סכום ובאותו יום. הן נוספות אוטומטית לכל חודש בלוח הבקרה.
        </Paragraph>
      </YStack>

      <XStack gap="$3" flexWrap="wrap">
        <SummaryCard title="הכנסות קבועות החודש" amount={income} theme="green" />
        <SummaryCard title="הוצאות קבועות החודש" amount={expense} theme="red" />
        <SummaryCard title="נטו קבוע" amount={income - expense} theme={income - expense < 0 ? 'red' : 'accent'} />
      </XStack>

      {editing ? (
        <CyclicForm
          key={editing.id}
          initial={editing}
          onSubmit={(rule) => {
            onUpdate(rule)
            setEditingId(null)
          }}
          onCancel={() => setEditingId(null)}
        />
      ) : (
        <CyclicForm onSubmit={onAdd} />
      )}

      <RuleList title="פעילות" rules={ongoing} emptyText="אין עדיין תנועות קבועות." {...rowProps} />
      {ended.length > 0 && <RuleList title="הסתיימו" rules={ended} emptyText="" {...rowProps} />}
    </YStack>
  )
}
