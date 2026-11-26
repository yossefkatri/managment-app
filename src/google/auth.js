// Google sign-in in the browser using Google Identity Services (token model).
// Scope `drive.file` only lets the app see files it created itself - never the rest of the Drive.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const SESSION_KEY = 'budget-tracker:session'

export class NeedsLoginError extends Error {
  constructor() {
    super('Google sign-in required')
    this.name = 'NeedsLoginError'
  }
}

export const hasClientId = Boolean(CLIENT_ID)

let gisPromise
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

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) ?? null
  } catch {
    return null
  }
}

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

export function rememberEmail(email) {
  const s = readSession()
  if (s) writeSession({ ...s, email })
}

/**
 * Returns an access token.
 * - interactive=false: only returns a stored, non-expired token; otherwise throws NeedsLoginError.
 * - interactive=true: opens the Google popup. Must be called from a click/tap.
 */
export async function getToken({ interactive = false, selectAccount = false } = {}) {
  if (hasValidToken() && !selectAccount) return readSession().token
  if (!interactive) throw new NeedsLoginError()
  if (!CLIENT_ID) throw new Error('VITE_GOOGLE_CLIENT_ID is not set')

  await loadGis()
  const previous = readSession()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      login_hint: selectAccount ? undefined : (previous?.email ?? undefined),
      callback: (res) => {
        if (res.error) return reject(new Error(res.error_description || res.error))
        writeSession({
          token: res.access_token,
          expiresAt: Date.now() + Number(res.expires_in) * 1000,
          email: previous?.email ?? null,
        })
        resolve(res.access_token)
      },
      error_callback: (err) => reject(new Error(err?.message || err?.type || 'Sign-in cancelled')),
    })
    const prompt = selectAccount ? 'select_account' : previous?.email ? '' : 'consent'
    client.requestAccessToken({ prompt })
  })
}

/** Forget the stored token (call on 401 so the next attempt asks for a new one). */
export function dropToken() {
  const s = readSession()
  if (s) writeSession({ email: s.email })
}

export async function signOut() {
  const s = readSession()
  writeSession(null)
  if (s?.token && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(s.token, () => {})
  }
}
