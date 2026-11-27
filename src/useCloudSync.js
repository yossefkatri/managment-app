import { useCallback, useEffect, useRef, useState } from 'react'
import * as auth from './google/auth.js'
import * as drive from './google/drive.js'
import { mergeTransactions } from './mergeTransactions.js'

// localStorage flag: '1' means this device has changes that haven't reached Drive yet.
// Stored (not just kept in memory) so it survives a reload or closing the app while offline.
const DIRTY_KEY = 'budget-tracker:dirty'
// Wait this long after the last change before uploading, so fast edits become one upload.
const SAVE_DELAY_MS = 1500

// Demo rows are for testing only and never go to Drive
const realOnly = (transactions) => transactions.filter((t) => !t.demo)
/** JSON of the real transactions only. Used to compare "what we have" with "what Drive has". */
const serialize = (transactions) => JSON.stringify(realOnly(transactions))

/** True when the device has unsaved changes. False if storage is unavailable. */
const isDirty = () => {
  try {
    return localStorage.getItem(DIRTY_KEY) === '1'
  } catch {
    return false
  }
}
/** Sets or clears the unsaved-changes flag. Never throws. */
const setDirty = (value) => {
  try {
    if (value) localStorage.setItem(DIRTY_KEY, '1')
    else localStorage.removeItem(DIRTY_KEY)
  } catch {
    // ignore
  }
}

/** Builds the content of the Drive file: a format version, a save time, and the real transactions. */
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
  // With a stored token we'll reconnect on mount (see the effect below), so start as 'connecting'.
  const [status, setStatus] = useState(auth.hasValidToken() ? 'connecting' : 'signed-out')
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  // Refs hold values the async functions need without re-creating them on every render.
  // Always the newest transactions, even inside an upload that started earlier
  const latest = useRef(transactions)
  // Drive id of budget-data.json; null while not connected (uploads are skipped)
  const fileId = useRef(null)
  // What Drive is known to contain (or, before the first sync, what was loaded from this device)
  const baseline = useRef(serialize(transactions))
  // Pending delayed upload (see SAVE_DELAY_MS)
  const timer = useRef(null)
  // Makes sure the automatic reconnect runs only once
  const autoConnectTried = useRef(false)

  latest.current = transactions

  /**
   * Turns an error into a status:
   * sign-in needed → 'needs-login', no network → 'offline', anything else → 'error' with its message.
   */
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

  /**
   * Uploads the current transactions to Drive if they differ from `baseline`.
   * Cancels any pending delayed upload first, and does nothing until connected.
   * Never opens a sign-in popup: if the token expired, the status becomes 'needs-login'.
   * `keepalive` lets the request finish while the page is being hidden or closed.
   */
  const upload = useCallback(
    async ({ keepalive = false } = {}) => {
      clearTimeout(timer.current)
      if (!fileId.current) return
      const json = serialize(latest.current)
      if (json === baseline.current) {
        // Nothing new to save
        setDirty(false)
        setStatus('synced')
        return
      }
      setStatus('saving')
      try {
        const token = await auth.getToken()
        await drive.updateData(token, fileId.current, toPayload(latest.current), { keepalive })
        baseline.current = json
        // Only report 'synced' if nothing changed during the upload;
        // otherwise the change effect has already scheduled the next upload.
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

  /**
   * Signs in (with a popup if `interactive`), finds or creates the Drive file,
   * and decides whose data wins - see the four cases below.
   * `selectAccount` shows Google's account chooser to switch accounts.
   */
  const connect = useCallback(
    async ({ interactive, selectAccount = false }) => {
      setError(null)
      setStatus('connecting')
      try {
        // Read before getToken(), so we can tell if the user signed in with a different account
        const previousEmail = auth.lastEmail()
        const token = await auth.getToken({ interactive, selectAccount })
        const me = await drive.getUser(token)
        const accountChanged = Boolean(previousEmail) && previousEmail !== me.emailAddress
        // The token response has no email, so save the real one now
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
          // Replace local data with Drive's, keeping this device's demo rows
          setTransactions((prev) => [...remoteTx, ...prev.filter((t) => t.demo)])
        }
        setDirty(false)
        setStatus('synced')
      } catch (err) {
        fileId.current = null
        // No usable token (and no popup allowed): just show the signed-out state, not an error
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

  /** Sign-in button handler: opens the Google popup (must run from a click). */
  const signIn = useCallback(() => connect({ interactive: true }), [connect])
  /** "Sign in with another account" handler: shows Google's account chooser. */
  const signInOtherAccount = useCallback(() => connect({ interactive: true, selectAccount: true }), [connect])

  /** Saves pending changes, then signs out and clears this device's copy. Returns false if saving failed. */
  const signOut = useCallback(async () => {
    if (fileId.current && serialize(latest.current) !== baseline.current) {
      await upload()
      // Still different → the upload failed; don't sign out and lose the changes
      if (serialize(latest.current) !== baseline.current) return false
    }
    clearTimeout(timer.current)
    await auth.signOut()
    fileId.current = null
    baseline.current = '[]' // matches serialize([]), so the empty list isn't marked dirty
    setDirty(false)
    setUser(null)
    setTransactions([])
    setStatus('signed-out')
    return true
  }, [upload, setTransactions])

  return { status, user, error, signIn, signInOtherAccount, signOut, lastEmail: auth.lastEmail(), hasClientId: auth.hasClientId }
}
