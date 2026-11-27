// Google sign-in in the browser using Google Identity Services (token model).
// Scope `drive.file` only lets the app see files it created itself - never the rest of the Drive.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
// localStorage key holding the session: { token, expiresAt, email }
const SESSION_KEY = 'budget-tracker:session'
// A token this close to expiring is treated as expired, so it can't run out mid-request.
const TOKEN_EXPIRY_MARGIN_MS = 60_000

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

let gisLoadPromise
/**
 * Loads the Google Identity Services script once and resolves when it's ready.
 * Later calls reuse the same promise. If loading fails, the promise is cleared
 * so the next call can try again.
 */
function loadGis() {
  gisLoadPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const gisScript = document.createElement('script')
    gisScript.src = GIS_SCRIPT_URL
    gisScript.async = true
    gisScript.onload = () => resolve()
    gisScript.onerror = () => {
      gisLoadPromise = undefined
      reject(new Error('Failed to load Google sign-in'))
    }
    document.head.appendChild(gisScript)
  })
  return gisLoadPromise
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
  const session = readSession()
  return Boolean(session?.token && session.expiresAt - Date.now() > TOKEN_EXPIRY_MARGIN_MS)
}

/**
 * Stores the account's email in the current session.
 * Call it after sign-in (e.g. with drive.getUser()), since Google's token response has no email.
 * Does nothing if there is no session.
 */
export function rememberEmail(email) {
  const session = readSession()
  if (session) writeSession({ ...session, email })
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
  const previousSession = readSession()
  return new Promise((resolve, reject) => {
    // Builds the client with our settings; no popup or network request yet.
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: DRIVE_FILE_SCOPE,
      // Pre-selects the last account, unless the user asked to pick another one.
      login_hint: selectAccount ? undefined : (previousSession?.email ?? undefined),
      // Called with Google's response: a token, or an OAuth error such as access_denied.
      callback: (tokenResponse) => {
        if (tokenResponse.error) {
          return reject(new Error(tokenResponse.error_description || tokenResponse.error))
        }
        writeSession({
          token: tokenResponse.access_token,
          expiresAt: Date.now() + Number(tokenResponse.expires_in) * 1000,
          email: previousSession?.email ?? null,
        })
        resolve(tokenResponse.access_token)
      },
      // Called when the flow fails before Google answers (popup blocked or closed).
      error_callback: (popupError) =>
        reject(new Error(popupError?.message || popupError?.type || 'Sign-in cancelled')),
    })
    // Account chooser to switch accounts; no prompt for a returning user; full consent the first time.
    const promptMode = selectAccount ? 'select_account' : previousSession?.email ? '' : 'consent'
    // Opens the popup. The result arrives in `callback` / `error_callback` above.
    tokenClient.requestAccessToken({ prompt: promptMode })
  })
}

/** Forget the stored token (call on 401 so the next attempt asks for a new one). */
export function dropToken() {
  const session = readSession()
  if (session) writeSession({ email: session.email })
}

/**
 * Signs out: deletes the whole session (token and email) and revokes the token with Google,
 * so it can't be used anymore even if it was copied somewhere.
 */
export async function signOut() {
  const session = readSession()
  writeSession(null)
  if (session?.token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(session.token, () => {})
  }
}
