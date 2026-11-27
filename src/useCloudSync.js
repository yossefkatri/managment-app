import { useCallback, useEffect, useRef, useState } from 'react'
import * as auth from './google/auth.js'
import * as drive from './google/drive.js'
import { mergeCyclic } from './cyclic.js'
import { mergeTransactions } from './mergeTransactions.js'

// localStorage flag: '1' means this device has changes that haven't reached Drive yet.
// Stored (not just kept in memory) so it survives a reload or closing the app while offline.
const DIRTY_KEY = 'budget-tracker:dirty'
// Wait this long after the last change before uploading, so fast edits become one upload.
const SAVE_DELAY_MS = 1500

// Demo rows are for testing only and never go to Drive
const realOnly = (transactions) => transactions.filter((t) => !t.demo)
/** What gets saved: the real transactions and the cyclic rules (never their generated occurrences). */
const savedPart = (data) => ({ transactions: realOnly(data.transactions), cyclic: data.cyclic })
/** JSON of the saved part only. Used to compare "what we have" with "what Drive has". */
const serialize = (data) => JSON.stringify(savedPart(data))
/** An account with no data, used after sign-out. */
const EMPTY_DATA = { transactions: [], cyclic: [] }

/** Reads the Drive file's content. Files saved before cyclic rules existed (version 1) have none. */
const fromPayload = (remote) => ({
  transactions: Array.isArray(remote?.transactions) ? remote.transactions : [],
  cyclic: Array.isArray(remote?.cyclic) ? remote.cyclic : [],
})

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

/**
 * Builds the content of the Drive file: a format version, a save time, the real transactions
 * and the cyclic rules. Version 2 added `cyclic`.
 */
const toPayload = (data) => ({
  version: 2,
  updatedAt: new Date().toISOString(),
  ...savedPart(data),
})

/**
 * Keeps `data` ({ transactions, cyclic }) in sync with Budget Tracker/budget-data.json in the user's Google Drive.
 *
 * status: 'signed-out' | 'connecting' | 'synced' | 'saving' | 'offline' | 'needs-login' | 'error'
 */
export default function useCloudSync(data, setData) {
  // With a stored token we'll reconnect on mount (see the effect below), so start as 'connecting'.
  const [status, setStatus] = useState(auth.hasValidToken() ? 'connecting' : 'signed-out')
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)

  // Refs hold values the async functions need without re-creating them on every render.
  // Always the newest data, even inside an upload that started earlier
  const latest = useRef(data)
  // Drive id of budget-data.json; null while not connected (uploads are skipped)
  const fileId = useRef(null)
  // What Drive is known to contain (or, before the first sync, what was loaded from this device)
  const baseline = useRef(serialize(data))
  // Pending delayed upload (see SAVE_DELAY_MS)
  const timer = useRef(null)
  // Makes sure the automatic reconnect runs only once
  const autoConnectTried = useRef(false)

  latest.current = data

  /**
   * Turns an error into a status, sets it, and returns it:
   * sign-in needed → 'needs-login', no network → 'offline', anything else → 'error' with its message.
   */
  const fail = useCallback((err) => {
    let failedStatus
    if (err instanceof auth.NeedsLoginError) {
      failedStatus = 'needs-login'
    } else if (!navigator.onLine || err instanceof TypeError) {
      failedStatus = 'offline' // fetch throws TypeError on network failure
    } else {
      setError(err.message)
      failedStatus = 'error'
    }
    setStatus(failedStatus)
    return failedStatus
  }, [])

  /**
   * Uploads the current data to Drive if they differ from `baseline`.
   * Cancels any pending delayed upload first, and does nothing until connected.
   * If the token expired: with `interactive` (only from a click) it opens the sign-in popup,
   * otherwise the status becomes 'needs-login'.
   * `keepalive` lets the request finish while the page is being hidden or closed.
   * Returns the failure status ('offline' | 'needs-login' | 'error') if it failed, otherwise undefined.
   */
  const upload = useCallback(
    async ({ keepalive = false, interactive = false } = {}) => {
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
        const token = await auth.getToken({ interactive })
        await drive.updateData(token, fileId.current, toPayload(latest.current), { keepalive })
        baseline.current = json
        // Only report 'synced' if nothing changed during the upload;
        // otherwise the change effect has already scheduled the next upload.
        if (serialize(latest.current) === json) {
          setDirty(false)
          setStatus('synced')
        }
      } catch (err) {
        return fail(err)
      }
    },
    [fail],
  )

  /**
   * Signs in (with a popup if `interactive`), finds or creates the Drive file,
   * and decides whose data wins - see the three cases below.
   * `selectAccount` shows Google's account chooser to switch accounts.
   * Returns the failure status if it failed, otherwise undefined.
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
        // Same account as the last session on this device (false on a new device or another account)
        const sameAccount = previousEmail === me.emailAddress
        // The token response has no email, so save the real one now
        auth.rememberEmail(me.emailAddress)
        setUser(me)

        const folderId = await drive.ensureFolder(token)
        const file = await drive.findDataFile(token, folderId)

        if (!file) {
          // First time: create the Drive file from what this device has
          fileId.current = await drive.createData(token, folderId, toPayload(latest.current))
          baseline.current = serialize(latest.current)
        } else if (sameAccount && isDirty()) {
          // The same account is back (e.g. its token expired while offline) with changes it made
          // on this device that never reached Drive: keep everything in the cloud and add only
          // the device's transactions and cyclic rules the cloud doesn't have
          fileId.current = file.id
          const remote = fromPayload(await drive.readData(token, file.id))
          const tx = mergeTransactions(remote.transactions, latest.current.transactions)
          const rules = mergeCyclic(remote.cyclic, latest.current.cyclic)
          const merged = { transactions: tx.merged, cyclic: rules.merged }
          if (tx.addedCount + rules.addedCount > 0) await drive.updateData(token, file.id, toPayload(merged))
          baseline.current = serialize(merged)
          // Update the ref right away (not only on the next render), so a signOut() that is
          // waiting on this connect sees the merged data as saved
          const next = { ...merged, transactions: [...merged.transactions, ...latest.current.transactions.filter((t) => t.demo)] }
          latest.current = next
          setData(next)
        } else {
          // New device or another account: the cloud data overrides this device's cache
          fileId.current = file.id
          const remote = fromPayload(await drive.readData(token, file.id))
          baseline.current = serialize(remote)
          // Replace local data with Drive's, keeping this device's demo rows
          setData((prev) => ({ ...remote, transactions: [...remote.transactions, ...prev.transactions.filter((t) => t.demo)] }))
        }
        setDirty(false)
        setStatus('synced')
      } catch (err) {
        fileId.current = null
        // No usable token (and no popup allowed): just show the signed-out state, not an error
        if (err instanceof auth.NeedsLoginError) {
          setStatus('signed-out')
          return 'signed-out'
        }
        return fail(err)
      }
    },
    [fail, setData],
  )

  // Reconnect automatically when a still-valid token is stored (e.g. after a page reload)
  useEffect(() => {
    if (autoConnectTried.current) return
    autoConnectTried.current = true
    if (auth.hasValidToken()) connect({ interactive: false })
  }, [connect])

  // Every change: mark dirty and schedule an upload
  useEffect(() => {
    if (serialize(data) === baseline.current) return
    setDirty(true)
    if (!fileId.current) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => upload(), SAVE_DELAY_MS)
  }, [data, upload])

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

  /**
   * Uploads any unsaved changes, then signs out and clears this device's copy.
   * Called from a click, so it may open the sign-in popup when the token has expired.
   * Returns { ok: true } when signed out, or { ok: false, reason } when the changes could not be
   * uploaded (the user stays signed in, so nothing is lost). `reason` is 'offline' for a
   * connection failure, otherwise 'needs-login' or 'error'.
   */
  const signOut = useCallback(async () => {
    const hasUnsavedChanges = () => isDirty() || serialize(latest.current) !== baseline.current
    if (hasUnsavedChanges()) {
      const failedStatus = fileId.current
        ? await upload({ interactive: true })
        : // Not connected to the Drive file (e.g. the startup connect failed):
          // reconnecting as the same account uploads this device's unsaved changes
          await connect({ interactive: true })
      // Still unsaved → uploading failed; don't sign out and lose the changes
      if (hasUnsavedChanges()) {
        return { ok: false, reason: failedStatus ?? 'error' }
      }
    }
    clearTimeout(timer.current)
    await auth.signOut()
    fileId.current = null
    baseline.current = serialize(EMPTY_DATA) // so the emptied data isn't marked dirty
    setDirty(false)
    setUser(null)
    setData(EMPTY_DATA)
    setStatus('signed-out')
    return { ok: true }
  }, [upload, connect, setData])

  return { status, user, error, signIn, signInOtherAccount, signOut, lastEmail: auth.lastEmail(), hasClientId: auth.hasClientId }
}
