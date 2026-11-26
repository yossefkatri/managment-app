import { useCallback, useEffect, useRef, useState } from 'react'
import * as auth from './google/auth.js'
import * as drive from './google/drive.js'
import { mergeTransactions } from './mergeTransactions.js'

const DIRTY_KEY = 'budget-tracker:dirty'
const SAVE_DELAY_MS = 1500

// Demo rows are for testing only and never go to Drive
const realOnly = (transactions) => transactions.filter((t) => !t.demo)
const serialize = (transactions) => JSON.stringify(realOnly(transactions))

const isDirty = () => {
  try {
    return localStorage.getItem(DIRTY_KEY) === '1'
  } catch {
    return false
  }
}
const setDirty = (value) => {
  try {
    if (value) localStorage.setItem(DIRTY_KEY, '1')
    else localStorage.removeItem(DIRTY_KEY)
  } catch {
    // ignore
  }
}

const toPayload = (transactions) => ({
  version: 1,
  updatedAt: new Date().toISOString(),
  transactions: realOnly(transactions),
})

/**
 * Keeps `transactions` in sync with Budget Tracker/budget-data.json in the user's Google Drive.
 *
 * status: 'signed-out' | 'connecting' | 'synced' | 'saving' | 'offline' | 'needs-login' | 'error'
 */
export default function useCloudSync(transactions, setTransactions) {
  const [status, setStatus] = useState(auth.hasValidToken() ? 'connecting' : 'signed-out')
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  const latest = useRef(transactions)
  const fileId = useRef(null)
  // What Drive is known to contain (or, before the first sync, what was loaded from this device)
  const baseline = useRef(serialize(transactions))
  const timer = useRef(null)
  const autoConnectTried = useRef(false)

  latest.current = transactions

  const fail = useCallback((err) => {
    if (err instanceof auth.NeedsLoginError) {
      setStatus('needs-login')
    } else if (!navigator.onLine || err instanceof TypeError) {
      setStatus('offline') // fetch throws TypeError on network failure
    } else {
      setError(err.message)
      setStatus('error')
    }
  }, [])

  const upload = useCallback(
    async ({ keepalive = false } = {}) => {
      clearTimeout(timer.current)
      if (!fileId.current) return
      const json = serialize(latest.current)
      if (json === baseline.current) {
        setDirty(false)
        setStatus('synced')
        return
      }
      setStatus('saving')
      try {
        const token = await auth.getToken()
        await drive.updateData(token, fileId.current, toPayload(latest.current), { keepalive })
        baseline.current = json
        if (serialize(latest.current) === json) {
          setDirty(false)
          setStatus('synced')
        }
      } catch (err) {
        fail(err)
      }
    },
    [fail],
  )

  const connect = useCallback(
    async ({ interactive, selectAccount = false }) => {
      setError(null)
      setStatus('connecting')
      try {
        const previousEmail = auth.lastEmail()
        const token = await auth.getToken({ interactive, selectAccount })
        const me = await drive.getUser(token)
        const accountChanged = Boolean(previousEmail) && previousEmail !== me.emailAddress
        auth.rememberEmail(me.emailAddress)
        setUser(me)

        const folderId = await drive.ensureFolder(token)
        const file = await drive.findDataFile(token, folderId)

        if (file && accountChanged && isDirty()) {
          // A different account signed in while this device still had unsaved changes:
          // keep everything in the cloud and add only the device's transactions the cloud doesn't have
          fileId.current = file.id
          const remote = await drive.readData(token, file.id)
          const remoteTx = Array.isArray(remote?.transactions) ? remote.transactions : []
          const { merged, addedCount } = mergeTransactions(remoteTx, latest.current)
          if (addedCount > 0) await drive.updateData(token, file.id, toPayload(merged))
          baseline.current = serialize(merged)
          setTransactions((prev) => [...merged, ...prev.filter((t) => t.demo)])
        } else if (!file) {
          // First time: create the Drive file from what this device has
          fileId.current = await drive.createData(token, folderId, toPayload(latest.current))
          baseline.current = serialize(latest.current)
        } else if (isDirty()) {
          // Unsaved changes from while we were offline/signed out: this device wins
          fileId.current = file.id
          await drive.updateData(token, file.id, toPayload(latest.current))
          baseline.current = serialize(latest.current)
        } else {
          // Drive is the source of truth
          fileId.current = file.id
          const remote = await drive.readData(token, file.id)
          const remoteTx = Array.isArray(remote?.transactions) ? remote.transactions : []
          baseline.current = JSON.stringify(remoteTx)
          setTransactions((prev) => [...remoteTx, ...prev.filter((t) => t.demo)])
        }
        setDirty(false)
        setStatus('synced')
      } catch (err) {
        fileId.current = null
        if (err instanceof auth.NeedsLoginError) setStatus('signed-out')
        else fail(err)
      }
    },
    [fail, setTransactions],
  )

  // Reconnect automatically when a still-valid token is stored (e.g. after a page reload)
  useEffect(() => {
    if (autoConnectTried.current) return
    autoConnectTried.current = true
    if (auth.hasValidToken()) connect({ interactive: false })
  }, [connect])

  // Every change: mark dirty and schedule an upload
  useEffect(() => {
    if (serialize(transactions) === baseline.current) return
    setDirty(true)
    if (!fileId.current) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => upload(), SAVE_DELAY_MS)
  }, [transactions, upload])

  // Flush when the app goes to the background, and retry when the network comes back
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') upload({ keepalive: true })
    }
    const onOnline = () => upload()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('online', onOnline)
    }
  }, [upload])

  const signIn = useCallback(() => connect({ interactive: true }), [connect])
  const signInOtherAccount = useCallback(() => connect({ interactive: true, selectAccount: true }), [connect])

  /** Saves pending changes, then signs out and clears this device's copy. Returns false if saving failed. */
  const signOut = useCallback(async () => {
    if (fileId.current && serialize(latest.current) !== baseline.current) {
      await upload()
      if (serialize(latest.current) !== baseline.current) return false
    }
    clearTimeout(timer.current)
    await auth.signOut()
    fileId.current = null
    baseline.current = '[]'
    setDirty(false)
    setUser(null)
    setTransactions([])
    setStatus('signed-out')
    return true
  }, [upload, setTransactions])

  return { status, user, error, signIn, signInOtherAccount, signOut, lastEmail: auth.lastEmail(), hasClientId: auth.hasClientId }
}
