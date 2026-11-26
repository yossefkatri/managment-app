// Minimal Google Drive REST v3 client for one JSON file inside one app folder.
import { NeedsLoginError, dropToken } from './auth.js'

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'

export const FOLDER_NAME = 'Budget Tracker'
export const FILE_NAME = 'budget-data.json'

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

const q = (query) => encodeURIComponent(query)

export async function getUser(token) {
  const res = await call(token, `${API}/about?fields=user(emailAddress,displayName)`)
  return (await res.json()).user
}

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

export async function findDataFile(token, folderId) {
  const query = `name='${FILE_NAME}' and '${folderId}' in parents and trashed=false`
  const res = await call(token, `${API}/files?q=${q(query)}&fields=files(id,modifiedTime)&spaces=drive`)
  const { files } = await res.json()
  return files[0] ?? null
}

export async function readData(token, fileId) {
  const res = await call(token, `${API}/files/${fileId}?alt=media`)
  return res.json()
}

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

export async function updateData(token, fileId, data, { keepalive = false } = {}) {
  await call(token, `${UPLOAD}/files/${fileId}?uploadType=media&fields=id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data, null, 2),
    keepalive,
  })
}
