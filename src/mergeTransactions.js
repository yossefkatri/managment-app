// Merges this device's transactions into the cloud copy.
// A local transaction is considered to already exist in the cloud when it has the same id, or the same
// category + description + date. In that case the cloud version wins; everything else from the device is added.

const entityKey = (t) => `${t.category}\u0000${(t.description ?? '').trim()}\u0000${t.date}`

export function mergeTransactions(cloud, local) {
  const ids = new Set(cloud.map((t) => t.id))
  const keys = new Set(cloud.map(entityKey))
  const added = []
  for (const t of local) {
    if (t.demo || ids.has(t.id) || keys.has(entityKey(t))) continue
    added.push(t)
    ids.add(t.id)
    keys.add(entityKey(t))
  }
  return { merged: [...cloud, ...added], addedCount: added.length }
}
