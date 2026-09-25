'use strict'

const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

const { CONNECTION_KEYS, connectionSearchFromUrl, findProtocolUrl } = require('./protocol.cjs')

describe('findProtocolUrl', () => {
  it('finds a pokepelago link among argv', () => {
    const argv = ['C:\\app\\Pokepelago Client.exe', 'pokepelago://connect?host=h&port=1&name=n']
    assert.equal(connectionSearchFromUrl(findProtocolUrl(argv)), '?host=h&port=1&name=n')
  })

  it('returns null when no link is present', () => {
    assert.equal(findProtocolUrl(['electron', '.', '--dev']), null)
  })

  it('matches the scheme case-insensitively', () => {
    assert.equal(findProtocolUrl(['POKEPELAGO://connect?host=h']), 'POKEPELAGO://connect?host=h')
  })

  it('ignores non-string arguments', () => {
    assert.equal(findProtocolUrl([1, null, 'pokepelago://connect?host=h']), 'pokepelago://connect?host=h')
  })
})

describe('connectionSearchFromUrl', () => {
  it('keeps only whitelisted connection params, in a stable order', () => {
    const url = 'pokepelago://connect?name=Ash&port=38281&host=archipelago.gg&evil=1'
    assert.equal(connectionSearchFromUrl(url), '?host=archipelago.gg&port=38281&name=Ash')
  })

  it('includes the password when present', () => {
    const url = 'pokepelago://connect?host=h&port=1&name=n&password=secret'
    assert.equal(connectionSearchFromUrl(url), '?host=h&port=1&name=n&password=secret')
  })

  it('drops empty values', () => {
    assert.equal(connectionSearchFromUrl('pokepelago://connect?host=h&port=&name='), '?host=h')
  })

  it('returns an empty string for other schemes', () => {
    assert.equal(connectionSearchFromUrl('archipelago://Ash:None@h:1'), '')
  })

  it('returns an empty string for malformed input', () => {
    assert.equal(connectionSearchFromUrl('not a url'), '')
    assert.equal(connectionSearchFromUrl(undefined), '')
  })

  it('exposes the whitelist it uses', () => {
    assert.deepEqual(CONNECTION_KEYS, ['host', 'port', 'name', 'password'])
  })
})
