import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SingleFlight } from './singleFlight'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => {
    resolve = res
  })
  return { promise, resolve }
}

test('parallel callers share one in-progress creation', async () => {
  const flight = new SingleFlight<object>()
  const result = {}
  const gate = deferred<object | null>()
  let createCount = 0
  let existing: object | null = null
  const create = () => {
    createCount += 1
    return gate.promise.then(value => {
      existing = value
      return value
    })
  }

  const first = flight.run(() => true, () => existing, create)
  const second = flight.run(() => true, () => existing, create)
  gate.resolve(result)

  assert.equal(await first, result)
  assert.equal(await second, result)
  assert.equal(createCount, 1)
})

test('a current caller retries after a stale creation is cancelled', async () => {
  const flight = new SingleFlight<object>()
  const staleCreation = deferred<object | null>()
  const result = {}
  let createCount = 0
  let staleRouteActive = true
  let existing: object | null = null
  const create = () => {
    createCount += 1
    const creation = createCount === 1 ? staleCreation.promise : Promise.resolve(result)
    return creation.then(value => {
      existing = value
      return value
    })
  }

  const staleCaller = flight.run(() => staleRouteActive, () => existing, create)
  const currentCaller = flight.run(() => true, () => existing, create)
  staleRouteActive = false
  staleCreation.resolve(null)

  assert.equal(await staleCaller, null)
  assert.equal(await currentCaller, result)
  assert.equal(createCount, 2)
})

test('a caller whose route becomes stale does not start creation', async () => {
  const flight = new SingleFlight<object>()
  const gate = deferred<object | null>()
  let allowed = true
  let createCount = 0
  const create = () => {
    createCount += 1
    return gate.promise
  }

  const first = flight.run(() => allowed, () => null, create)
  const second = flight.run(() => allowed, () => null, create)
  allowed = false
  gate.resolve(null)

  assert.equal(await first, null)
  assert.equal(await second, null)
  assert.equal(createCount, 1)
})
