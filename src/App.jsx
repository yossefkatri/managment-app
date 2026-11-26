import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  H1,
  Input,
  Paragraph,
  Separator,
  SizableText,
  XStack,
  YStack,
} from 'tamagui'
import TrendChart from './TrendChart.jsx'
import { createDemoTransactions } from './demoData.js'
import useCloudSync from './useCloudSync.js'

const SYNC_LABELS = {
  connecting: 'מתחבר ל-Drive…',
  synced: '✓ נשמר ב-Google Drive',
  saving: 'שומר…',
  offline: 'אין חיבור לרשת – השינויים יישמרו כשהחיבור יחזור',
  'needs-login': 'פג תוקף ההתחברות – השינויים שמורים במכשיר',
  error: 'שגיאה בשמירה ל-Drive',
}

function LoginScreen({ sync }) {
  const busy = sync.status === 'connecting'
  return (
    <YStack backgroundColor="$background" minHeight="100vh" alignItems="center" justifyContent="center" padding="$4">
      <Card width="100%" maxWidth={400} padding="$5" gap="$4" borderWidth={1} borderColor="$border-color">
        <YStack gap="$1">
          <H1 size="$9">הכסף שלי</H1>
          <Paragraph color="$color-10">
            התחבר עם חשבון Google כדי לשמור את הנתונים בתיקייה "Budget Tracker" ב-Google Drive שלך.
          </Paragraph>
        </YStack>
        {sync.hasClientId ? (
          <Button theme="accent" disabled={busy} opacity={busy ? 0.6 : 1} onPress={sync.signIn}>
            {busy ? 'מתחבר…' : sync.lastEmail ? `התחבר בתור ${sync.lastEmail}` : 'התחבר עם Google'}
          </Button>
        ) : null}
        {sync.hasClientId && sync.lastEmail && !busy ? (
          <Button variant="outlined" onPress={sync.signInOtherAccount}>
            התחבר עם חשבון אחר
          </Button>
        ) : null}
        {sync.hasClientId ? null : (
          <Paragraph theme="red" color="$color-10">
            חסר Client ID של Google. הגדר VITE_GOOGLE_CLIENT_ID בקובץ ‎.env.local והפעל מחדש את השרת.
          </Paragraph>
        )}
        {sync.error && (
          <Paragraph theme="red" color="$color-10" size="$2">
            {sync.error}
          </Paragraph>
        )}
      </Card>
    </YStack>
  )
}

function SyncBar({ sync }) {
  const warn = ['offline', 'needs-login', 'error'].includes(sync.status)
  const onSignOut = async () => {
    const ok = await sync.signOut()
    if (!ok) alert('לא הצלחתי לשמור את השינויים האחרונים ל-Drive, ולכן לא התנתקתי. נסה שוב כשיש חיבור.')
  }
  return (
    <XStack alignItems="center" gap="$2" flexWrap="wrap">
      <SizableText size="$2" flex={1} theme={warn ? 'red' : undefined} color="$color-10">
        {SYNC_LABELS[sync.status]}
        {sync.status === 'error' && sync.error ? ` (${sync.error})` : ''}
        {sync.user?.emailAddress ? ` · ${sync.user.emailAddress}` : ''}
      </SizableText>
      {sync.status === 'needs-login' && (
        <Button size="sm" theme="accent" onPress={sync.signIn}>
          התחבר מחדש
        </Button>
      )}
      <Button size="sm" variant="outlined" onPress={onSignOut}>
        התנתק
      </Button>
    </XStack>
  )
}

const STORAGE_KEY = 'budget-tracker:transactions'

const CATEGORIES = {
  income: ['משכורת', 'עבודה נוספת', 'מתנה', 'אחר'],
  expense: ['אוכל', 'דיור', 'תחבורה', 'חשבונות', 'בילויים', 'קניות', 'בריאות', 'אחר'],
}

const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })

const today = () => new Date().toISOString().slice(0, 10)
const monthOf = (date) => date.slice(0, 7)

function loadTransactions() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    // Demo data is never loaded on startup; it only appears when the user toggles it on
    return (JSON.parse(stored) ?? []).filter((t) => !t.demo)
  } catch {
    return []
  }
}

function SummaryCard({ title, amount, theme }) {
  return (
    <Card theme={theme} flex={1} minWidth={150} padding="$4" borderWidth={1} borderColor="$border-color">
      <SizableText size="$3" color="$color-11">
        {title}
      </SizableText>
      <SizableText size="$7" fontWeight="700">
        {money.format(amount)}
      </SizableText>
    </Card>
  )
}

function TransactionForm({ onAdd }) {
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES.expense[0])
  const [date, setDate] = useState(today())

  const value = Number(amount)
  const valid = value > 0 && date

  const switchType = (next) => {
    setType(next)
    setCategory(CATEGORIES[next][0])
  }

  const submit = () => {
    if (!valid) return
    onAdd({
      id: crypto.randomUUID(),
      type,
      amount: value,
      description: description.trim(),
      category,
      date,
    })
    setAmount('')
    setDescription('')
  }

  return (
    <Card padding="$4" gap="$3" borderWidth={1} borderColor="$border-color">
      <SizableText size="$5" fontWeight="700">
        תנועה חדשה
      </SizableText>

      <XStack gap="$2">
        <Button
          flex={1}
          theme={type === 'expense' ? 'red' : undefined}
          variant={type === 'expense' ? undefined : 'outlined'}
          onPress={() => switchType('expense')}
        >
          הוצאה
        </Button>
        <Button
          flex={1}
          theme={type === 'income' ? 'green' : undefined}
          variant={type === 'income' ? undefined : 'outlined'}
          onPress={() => switchType('income')}
        >
          הכנסה
        </Button>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        <Input
          flex={1}
          minWidth={120}
          placeholder="סכום ₪"
          inputMode="decimal"
          value={amount}
          onChangeText={(text) => setAmount(text.replace(/[^\d.]/g, ''))}
        />
        <Input flex={1} minWidth={140} type="date" value={date} onChangeText={setDate} />
      </XStack>

      <Input
        placeholder="תיאור (לא חובה)"
        value={description}
        onChangeText={setDescription}
        onSubmitEditing={submit}
      />

      <XStack gap="$2" flexWrap="wrap">
        {CATEGORIES[type].map((c) => (
          <Button
            key={c}
            size="sm"
            theme={c === category ? 'accent' : undefined}
            variant={c === category ? undefined : 'outlined'}
            onPress={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </XStack>

      <Button theme="accent" disabled={!valid} opacity={valid ? 1 : 0.5} onPress={submit}>
        הוסף
      </Button>
    </Card>
  )
}

function TransactionRow({ tx, onDelete }) {
  const isIncome = tx.type === 'income'
  return (
    <XStack alignItems="center" gap="$3" paddingVertical="$2">
      <YStack flex={1}>
        <SizableText fontWeight="600">{tx.description || tx.category}</SizableText>
        <SizableText size="$2" color="$color-10">
          {tx.category} · {new Date(tx.date).toLocaleDateString('he-IL')}
        </SizableText>
      </YStack>
      <SizableText theme={isIncome ? 'green' : 'red'} color="$color-10" fontWeight="700">
        {isIncome ? '+' : '−'}
        {money.format(tx.amount)}
      </SizableText>
      <Button size="sm" variant="outlined" onPress={() => onDelete(tx.id)} aria-label="מחק">
        ✕
      </Button>
    </XStack>
  )
}

export default function App() {
  const [transactions, setTransactions] = useState(loadTransactions)
  const [month, setMonth] = useState(monthOf(today()))

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
  }, [transactions])

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

  const sync = useCloudSync(transactions, setTransactions)
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
