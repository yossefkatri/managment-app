import { useEffect, useMemo, useState } from 'react'
import { Button, H1, ScrollView, XStack, YStack, useMedia } from 'tamagui'
import LoginScreen from './components/LoginScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import { expandCyclic, firstCyclicMonth } from './cyclic.js'
import { createDemoTransactions } from './demoData.js'
import { monthOf, today } from './format.js'
import CyclicPage from './pages/CyclicPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import { PAGES } from './pages.js'
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

/** The page in the URL hash (#profile, #dashboard, …), so a reload stays on the same page. */
function pageFromHash() {
  const id = location.hash.slice(1)
  return PAGES.some((p) => p.id === id) ? id : 'dashboard'
}

export default function App() {
  const [data, setData] = useState(loadData)
  const { transactions, cyclic } = data
  const [month, setMonth] = useState(monthOf(today()))
  const [page, setPage] = useState(pageFromHash)
  // Phones: the sidebar is a drawer opened from the top bar
  const [drawerOpen, setDrawerOpen] = useState(false)
  const media = useMedia()
  const wide = media.md

  /** Updates only the transactions list (`update` receives the previous list). */
  const setTransactions = (update) => setData((prev) => ({ ...prev, transactions: update(prev.transactions) }))
  /** Updates only the cyclic rules (`update` receives the previous list). */
  const setCyclic = (update) => setData((prev) => ({ ...prev, cyclic: update(prev.cyclic) }))

  // The cyclic rules' occurrences are generated here, only for display - they are never stored.
  // They run from the first rule's start month up to this month, or to the selected month when
  // the user looks ahead, so a future month already shows its expected fixed incomes and expenses.
  const currentMonth = monthOf(today())
  const lastMonth = month > currentMonth ? month : currentMonth
  const displayedTransactions = useMemo(() => {
    const from = firstCyclicMonth(cyclic)
    return from ? [...transactions, ...expandCyclic(cyclic, from, lastMonth)] : transactions
  }, [transactions, cyclic, lastMonth])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.transactions))
    localStorage.setItem(CYCLIC_STORAGE_KEY, JSON.stringify(data.cyclic))
  }, [data])

  // Follow the browser's back/forward buttons
  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navigate = (id) => {
    if (location.hash.slice(1) !== id) location.hash = id
    setPage(id)
    setDrawerOpen(false)
  }

  const addTx = (tx) => setTransactions((prev) => [...prev, tx])
  const deleteTx = (id) => setTransactions((prev) => prev.filter((t) => t.id !== id))
  const addCyclic = (rule) => setCyclic((prev) => [...prev, rule])
  const updateCyclic = (rule) => setCyclic((prev) => prev.map((r) => (r.id === rule.id ? rule : r)))
  const deleteCyclic = (id) => setCyclic((prev) => prev.filter((r) => r.id !== id))

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

  const content =
    page === 'profile' ? (
      <ProfilePage
        sync={sync}
        transactionCount={transactions.filter((t) => !t.demo).length}
        cyclicCount={cyclic.length}
      />
    ) : page === 'cyclic' ? (
      <CyclicPage rules={cyclic} onAdd={addCyclic} onUpdate={updateCyclic} onDelete={deleteCyclic} />
    ) : (
      <DashboardPage
        transactions={displayedTransactions}
        month={month}
        onMonthChange={setMonth}
        onAdd={addTx}
        onAddCyclic={addCyclic}
        onDelete={deleteTx}
        onManageCyclic={() => navigate('cyclic')}
        hasDemo={hasDemo}
        onToggleDemo={toggleDemo}
      />
    )

  return (
    <XStack backgroundColor="$background" height="100vh">
      {wide && <Sidebar page={page} onNavigate={navigate} sync={sync} />}

      <YStack flex={1} minWidth={0}>
        {!wide && (
          <XStack
            alignItems="center"
            gap="$2"
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderBottomWidth={1}
            borderColor="$border-color"
          >
            <Button size="sm" chromeless onPress={() => setDrawerOpen(true)} aria-label="פתח תפריט">
              ☰
            </Button>
            <H1 size="$6">הכסף שלי</H1>
          </XStack>
        )}
        <ScrollView flex={1}>
          <YStack alignItems="center" padding="$4">
            <YStack width="100%" maxWidth={760}>
              {content}
            </YStack>
          </YStack>
        </ScrollView>
      </YStack>

      {!wide && drawerOpen && (
        <XStack position="fixed" top={0} bottom={0} left={0} right={0} zIndex={900}>
          <Sidebar page={page} onNavigate={navigate} sync={sync} />
          <YStack
            flex={1}
            backgroundColor="rgba(0,0,0,0.4)"
            onPress={() => setDrawerOpen(false)}
            aria-label="סגור תפריט"
          />
        </XStack>
      )}
    </XStack>
  )
}
