'use strict'

// Deep link used by the Archipelago Launcher (and the Pokepelago APWorld) to hand a
// slot connection to this desktop client:
//   pokepelago://connect?host=<host>&port=<port>&name=<slot>&password=<password>
// The bundled web client already auto-connects from ?host=&port=&name=, so the app only
// needs to forward those (whitelisted) parameters to the page it loads.

const PROTOCOL = 'pokepelago'
const CONNECTION_KEYS = ['host', 'port', 'name', 'password']

function findProtocolUrl(argv) {
  if (!Array.isArray(argv)) return null
  return argv.find(
    (arg) => typeof arg === 'string' && arg.toLowerCase().startsWith(`${PROTOCOL}://`)
  ) || null
}

function connectionSearchFromUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return ''
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return ''
  }
  if (parsed.protocol !== `${PROTOCOL}:`) return ''

  const search = new URLSearchParams()
  for (const key of CONNECTION_KEYS) {
    const value = parsed.searchParams.get(key)
    if (value) search.set(key, value)
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

module.exports = { PROTOCOL, CONNECTION_KEYS, findProtocolUrl, connectionSearchFromUrl }
