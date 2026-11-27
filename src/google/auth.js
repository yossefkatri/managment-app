// Google sign-in in the browser using Google Identity Services (token model).
// Scope `drive.file` only lets the app see files it created itself - never the rest of the Drive.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
// localStorage key holding the session: { token, expiresAt, email }
const SESSION_KEY = 'budget-tracker:session'

/**
 * Thrown when there is no usable token and the user has to sign in (via a click).
 * Callers catch it to show a "Sign in" button instead of an error.
 */
export class NeedsLoginError extends Error {
  constructor() {
    super('Google sign-in required')
    this.name = 'NeedsLoginError'
  }
}

/** True when VITE_GOOGLE_CLIENT_ID is configured, i.e. Google sync can be offered at all. */
export const hasClientId = Boolean(CLIENT_ID)

let gisPromise
/**
 * Loads the Google Identity Services script once and resolves when it's ready.
 * Later calls reuse the same promise. If loading fails, the promise is cleared
 * so the next call can try again.
 */
function loadGis() {
  gisPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      gisPromise = undefined
      reject(new Error('Failed to load Google sign-in'))
    }
    document.head.appendChild(script)
  })
  return gisPromise
}

/** Reads the stored session from localStorage. Returns null if missing, unreadable or storage is blocked. */
function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) ?? null
  } catch {
    return null
  }
}

/** Saves the session to localStorage, or removes it when `session` is null. Never throws. */
function writeSession(session) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // storage unavailable - the session just won't survive a reload
  }
}

/** Email of the last signed-in account (used as a login hint), even if the token expired. */
export const lastEmail = () => readSession()?.email ?? null

/** True when a non-expired access token is stored, so we can reconnect without a popup. */
export function hasValidToken() {
  const s = readSession()
  return Boolean(s?.token && s.expiresAt - Date.now() > 60_000)
}

/**
 * Stores the account's email in the current session.
 * Call it after sign-in (e.g. with drive.getUser()), since Google's token response has no email.
 * Does nothing if there is no session.
 */
export function rememberEmail(email) {
  const s = readSession()
  if (s) writeSession({ ...s, email })
}

/**
 * Returns an access token.
 * - interactive=false: only returns a stored, non-expired token; otherwise throws NeedsLoginError.
 * - interactive=true: opens the Google popup. Must be called from a click/tap.
 * - selectAccount=true: ignores the stored token and the saved email, and shows Google's
 *   account chooser so the user can switch to another account.
 * On success the new token and its expiry time are saved to localStorage.
 */
export async function getToken({ interactive = false, selectAccount = false } = {}) {
  if (hasValidToken() && !selectAccount) return readSession().token
  if (!interactive) throw new NeedsLoginError()
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set')

  await loadGis()
  // Snapshot of the session before the popup - the callback below overwrites it.
  const previous = readSession()
  return new Promise((resolve, reject) => {
    // Builds the client with our settings; no popup or network request yet.
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      // Pre-selects the last account, unless the user asked to pick another one.
      login_hint: selectAccount ? undefined : (previous?.email ?? undefined),
      // Called with Google's response: a token, or an OAuth error such as access_denied.
      callback: (res) => {
        if (res.error) return reject(new Error(res.error_description || res.error))
        writeSession({
          token: res.access_token,
          expiresAt: Date.now() + Number(res.expires_in) * 1000,
          email: previous?.email ?? null,
        })
        resolve(res.access_token)
      },
      // Called when the flow fails before Google answers (popup blocked or closed).
      error_callback: (err) => reject(new Error(err?.message || err?.type || 'Sign-in cancelled')),
    })
    // Account chooser to switch accounts; no prompt for a returning user; full consent the first time.
    const prompt = selectAccount ? 'select_account' : previous?.email ? '' : 'consent'
    // Opens the popup. The result arrives in `callback` / `error_callback` above.
    client.requestAccessToken({ prompt })
  })
}

/** Forget the stored token (call on 401 so the next attempt asks for a new one). */
export function dropToken() {
  const s = readSession()
  if (s) writeSession({ email: s.email })
}

/**
 * Signs out: deletes the whole session (token and email) and revokes the token with Google,
 * so it can't be used anymore even if it was copied somewhere.
 */
export async function signOut() {
  const s = readSession()
  writeSession(null)
  if (s?.token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(s.token, () => {})
  }
}
