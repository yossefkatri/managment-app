// Minimal Google Drive REST v3 client for one JSON file inside one app folder.
import { NeedsLoginError, dropToken } from './auth.js'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export const FOLDER_NAME = 'Budget Tracker'
export const FILE_NAME = 'budget-data.json'

/**
 * Sends an authenticated request to the Drive API and returns the raw Response.
 * - Adds the `Authorization: Bearer <token>` header (caller headers are merged on top).
 * - On 401 (token expired or revoked): forgets the stored token and throws NeedsLoginError,
 *   so the UI can ask the user to sign in again.
 * - On any other non-2xx status: throws an Error with the status and the first 200 chars of the body.
 */
async function call(token, url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  })
  if (res.status === 401) {
    dropToken()
    throw new NeedsLoginError()
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Drive ${res.status}: ${text.slice(0, 200)}`)
  }
  return res
}

/** URL-encodes a Drive search query for use in the `q=` parameter. */
const q = (query) => encodeURIComponent(query)

/**
 * Returns the signed-in Google account: `{ emailAddress, displayName }`.
 * Needed because the GIS token response does not include the user's email.
 */
export async function getUser(token) {
  const res = await call(token, `${API}/about?fields=user(emailAddress,displayName)`)
  return (await res.json()).user
}

/**
 * Returns the id of the app folder (FOLDER_NAME), creating it if it doesn't exist.
 * With the `drive.file` scope the search only sees folders this app created,
 * so a user's own folder with the same name is never picked up.
 */
export async function ensureFolder(token) {
  const query = `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await call(token, `${API}/files?q=${q(query)}&fields=files(id)&spaces=drive`)
  const { files } = await res.json()
  if (files.length) return files[0].id

  const created = await call(token, `${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  return (await created.json()).id
}

/**
 * Looks for the data file (FILE_NAME) inside the given folder.
 * Returns `{ id, modifiedTime }`, or null if it hasn't been created yet.
 * Files in the trash are ignored.
 */
export async function findDataFile(token, folderId) {
  const query = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
  const res = await call(token, `${API}/files?q=${q(query)}&fields=files(id,modifiedTime)&spaces=drive`)
  const { files } = await res.json()
  return files[0] ?? null
}

/** Downloads the file's content (`alt=media`) and parses it as JSON. */
export async function readData(token, fileId) {
  const res = await call(token, `${API}/files/${fileId}?alt=media`)
  return res.json()
}

/**
 * Creates the data file in the folder with `data` as its content and returns the new file id.
 * Uses a multipart upload so the metadata (name, parent folder, type) and the content
 * are sent in one request. The parts are separated by a random `boundary` string.
 */
export async function createData(token, folderId, data) {
  const boundary = `budget-${crypto.randomUUID()}`
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: [folderId], mimeType: 'application/json' }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(data, null, 2) +
    `\r\n--${boundary}--`
  const res = await call(token, `${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return (await res.json()).id
}

/**
 * Replaces the content of an existing data file with `data` (metadata stays unchanged).
 * `keepalive: true` lets the request finish even if the page is closing,
 * e.g. when saving on tab close. Browsers limit keepalive bodies to about 64 KB.
 */
export async function updateData(token, fileId, data, { keepalive = false } = {}) {
  await call(token, `${UPLOAD}/files/${fileId}?uploadType=media&fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data, null, 2),
    keepalive,
  })
}
