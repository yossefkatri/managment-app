import { useMemo } from 'react'
import { Button, Card, H2, Input, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui'
import TrendChart from '../TrendChart.jsx'
import SummaryCard from '../components/SummaryCard.jsx'
import TransactionForm from '../components/TransactionForm.jsx'
import TransactionRow from '../components/TransactionRow.jsx'
import { monthOf, today } from '../format.js'

/** The selected month: totals, the trend chart, a form for a new transaction, and the month's list. */
export default function DashboardPage({ transactions, month, onMonthChange, onAdd, onDelete, hasDemo, onToggleDemo }) {
  const monthTx = useMemo(
    () =>
      transactions
        .filter((t) => monthOf(t.date) === month)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, month],
  )

  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense

  return (
    <YStack gap="$4">
      <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
        <H2 size="$8">לוח בקרה</H2>
        <Input width={170} type="month" value={month} onChangeText={onMonthChange} aria-label="חודש" />
      </XStack>

      <XStack gap="$3" flexWrap="wrap">
        <SummaryCard title="הכנסות" amount={income} theme="green" />
        <SummaryCard title="הוצאות" amount={expense} theme="red" />
        <SummaryCard title="יתרה" amount={balance} theme={balance < 0 ? 'red' : 'accent'} />
      </XStack>

      <Card padding="$4" gap="$3" borderWidth={1} borderColor="$border-color">
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$2">
          <SizableText size="$5" fontWeight="700">
            מגמה חודשית
          </SizableText>
          <Button size="sm" variant="outlined" onPress={onToggleDemo}>
            {hasDemo ? 'הסר נתוני דמה' : 'טען נתוני דמה'}
          </Button>
        </XStack>
        <TrendChart
          transactions={transactions}
          currentMonth={monthOf(today())}
          selectedMonth={month}
          onSelectMonth={onMonthChange}
        />
      </Card>

      <TransactionForm onAdd={onAdd} />

      <Card padding="$4" borderWidth={1} borderColor="$border-color">
        <SizableText size="$5" fontWeight="700" marginBottom="$2">
          תנועות החודש
        </SizableText>
        {monthTx.length === 0 ? (
          <Paragraph color="$color-10">אין עדיין תנועות בחודש הזה.</Paragraph>
        ) : (
          monthTx.map((tx, i) => (
            <YStack key={tx.id}>
              {i > 0 && <Separator />}
              <TransactionRow tx={tx} onDelete={onDelete} />
            </YStack>
          ))
        )}
      </Card>
    </YStack>
  )
}
