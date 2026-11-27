import { useEffect, useMemo, useState } from 'react'
import { Button, Card, H1, Input, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui'
import TrendChart from './TrendChart.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import SummaryCard from './components/SummaryCard.jsx'
import SyncBar from './components/SyncBar.jsx'
import TransactionForm from './components/TransactionForm.jsx'
import TransactionRow from './components/TransactionRow.jsx'
import { createDemoTransactions } from './demoData.js'
import { monthOf, today } from './format.js'
import useCloudSync from './useCloudSync.js'

const STORAGE_KEY = 'budget-tracker:transactions'
// Only the cyclic rules are stored; their monthly occurrences are generated when displayed
const CYCLIC_STORAGE_KEY = 'budget-tracker:cyclic'

/** Reads a JSON array from localStorage; [] when missing, unreadable or storage is blocked. */
function loadList(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key))
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** This device's copy of the data: { transactions, cyclic }. */
function loadData() {
  return {
    // Demo data is never loaded on startup; it only appears when the user toggles it on
    transactions: loadList(STORAGE_KEY).filter((t) => !t.demo),
    cyclic: loadList(CYCLIC_STORAGE_KEY),
  }
}

export default function App() {
  const [data, setData] = useState(loadData)
  const { transactions } = data
  const [month, setMonth] = useState(monthOf(today()))

  /** Updates only the transactions list (`update` receives the previous list). */
  const setTransactions = (update) => setData((prev) => ({ ...prev, transactions: update(prev.transactions) }))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.transactions))
    localStorage.setItem(CYCLIC_STORAGE_KEY, JSON.stringify(data.cyclic))
  }, [data])

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

  const addTx = (tx) => setTransactions((prev) => [...prev, tx])
  const deleteTx = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id))

  const [hasDemo, setHasDemo] = useState(false)
  const toggleDemo = () => {
    setTransactions((prev) =>
      hasDemo ? prev.filter((t) => !t.demo) : [...prev, ...createDemoTransactions()],
    )
    setHasDemo(!hasDemo)
  }

  const sync = useCloudSync(data, setData)
  if (sync.status === 'signed-out' || (sync.status === 'connecting' && !sync.user)) {
    return <LoginScreen sync={sync} />
  }

  return (
    <YStack backgroundColor="$background" minHeight="100vh" alignItems="center" padding="$4">
      <YStack width="100%" maxWidth={720} gap="$4">
        <SyncBar sync={sync} />
        <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap" gap="$3">
          <YStack>
            <H1 size="$9">הכסף שלי</H1>
            <Paragraph color="$color-10">מעקב הכנסות והוצאות</Paragraph>
          </YStack>
          <Input width={170} type="month" value={month} onChangeText={setMonth} />
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
            <Button size="sm" variant="outlined" onPress={toggleDemo}>
              {hasDemo ? 'הסר נתוני דמה' : 'טען נתוני דמה'}
            </Button>
          </XStack>
          <TrendChart
            transactions={transactions}
            currentMonth={monthOf(today())}
            selectedMonth={month}
            onSelectMonth={setMonth}
          />
        </Card>

        <TransactionForm onAdd={addTx} />

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
                <TransactionRow tx={tx} onDelete={deleteTx} />
              </YStack>
            ))
          )}
        </Card>
      </YStack>
    </YStack>
  )
}
