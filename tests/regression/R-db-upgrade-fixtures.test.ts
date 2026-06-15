import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'

const opened: Dexie[] = []
const dbNames: string[] = []

function track<T extends Dexie>(db: T): T {
  opened.push(db)
  return db
}

function nextName(prefix: string): string {
  const name = `${prefix}-${Math.random()}`
  dbNames.push(name)
  return name
}

afterEach(async () => {
  for (const db of opened.splice(0)) db.close()
  for (const name of dbNames.splice(0)) await Dexie.delete(name)
})

class OldV30AnalysisDB extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(30).stores({
      references: '++id, projectId, type, createdAt',
      referenceChunkAnalysis: '++id, referenceId, chunkIndex',
      importSessions: '++id, projectId, status, updatedAt, fileHash, targetWorldGroupId',
      importFiles: 'sessionId, fileHash, createdAt',
    })
  }
}

class UpgradedV31AnalysisDB extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(30).stores({
      references: '++id, projectId, type, createdAt',
      referenceChunkAnalysis: '++id, referenceId, chunkIndex',
      importSessions: '++id, projectId, status, updatedAt, fileHash, targetWorldGroupId',
      importFiles: 'sessionId, fileHash, createdAt',
    })
    this.version(31).stores({
      referenceChunkAnalysis: '++id, referenceId, chunkIndex',
    }).upgrade(async (tx) => {
      await tx.table('referenceChunkAnalysis').clear()
      await tx.table('references').toCollection().modify((r: { analysisStatus?: string; analysisProgress?: number }) => {
        if (r.analysisStatus && r.analysisStatus !== 'none') {
          r.analysisStatus = 'none'
          r.analysisProgress = 0
        }
      })
    })
  }
}

class OldV31MasterDB extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(31).stores({
      references: '++id, projectId, type, createdAt',
      masterWorks: '++id, projectId, genre, status, updatedAt',
      masterChunkAnalysis: '++id, workId, chunkIndex',
      masterChapterBeats: '++id, workId, chapterIndex, type',
      masterStyleMetrics: '++id, workId',
      masterInsights: '++id, genre, updatedAt',
    })
  }
}

class UpgradedV32MasterDB extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(31).stores({
      references: '++id, projectId, type, createdAt',
      masterWorks: '++id, projectId, genre, status, updatedAt',
      masterChunkAnalysis: '++id, workId, chunkIndex',
      masterChapterBeats: '++id, workId, chapterIndex, type',
      masterStyleMetrics: '++id, workId',
      masterInsights: '++id, genre, updatedAt',
    })
    this.version(32).stores({
      masterWorks: null,
      masterChunkAnalysis: null,
      masterChapterBeats: null,
      masterStyleMetrics: null,
      masterInsights: null,
    })
  }
}

describe('DB upgrade fixtures · real Dexie version transitions', () => {
  it('v30→v31 clears old reference analysis but preserves import session blobs', async () => {
    const name = nextName('upgrade-v31')
    const oldDb = track(new OldV30AnalysisDB(name))
    await oldDb.open()
    const refId = await oldDb.table('references').add({
      projectId: 1,
      type: 'story',
      title: '旧分析参考',
      analysisStatus: 'done',
      analysisProgress: 100,
      createdAt: Date.now(),
    })
    await oldDb.table('referenceChunkAnalysis').add({ referenceId: refId, chunkIndex: 0, analysis: '{}' })
    const sessionId = await oldDb.table('importSessions').add({
      projectId: 1,
      status: 'paused',
      updatedAt: Date.now(),
      fileHash: 'hash',
      targetWorldGroupId: null,
    })
    await oldDb.table('importFiles').add({
      sessionId,
      fileHash: 'hash',
      blob: new Blob(['raw text']),
      createdAt: Date.now(),
    })
    oldDb.close()

    const upgradedDb = track(new UpgradedV31AnalysisDB(name))
    await upgradedDb.open()

    expect(await upgradedDb.table('referenceChunkAnalysis').count()).toBe(0)
    const ref = await upgradedDb.table('references').get(refId)
    expect(ref.analysisStatus).toBe('none')
    expect(ref.analysisProgress).toBe(0)
    expect(await upgradedDb.table('importSessions').count()).toBe(1)
    expect(await upgradedDb.table('importFiles').count()).toBe(1)
  })

  it('v31→v32 removes obsolete master study stores without touching references', async () => {
    const name = nextName('upgrade-v32')
    const oldDb = track(new OldV31MasterDB(name))
    await oldDb.open()
    await oldDb.table('references').add({ projectId: 1, type: 'story', title: '保留参考', createdAt: Date.now() })
    const workId = await oldDb.table('masterWorks').add({ projectId: 1, genre: 'fantasy', status: 'done', updatedAt: Date.now() })
    await oldDb.table('masterChunkAnalysis').add({ workId, chunkIndex: 0 })
    await oldDb.table('masterChapterBeats').add({ workId, chapterIndex: 1, type: 'hook' })
    await oldDb.table('masterStyleMetrics').add({ workId })
    await oldDb.table('masterInsights').add({ genre: 'fantasy', updatedAt: Date.now() })
    oldDb.close()

    const upgradedDb = track(new UpgradedV32MasterDB(name))
    await upgradedDb.open()
    expect(await upgradedDb.table('references').count()).toBe(1)
    upgradedDb.close()

    const stores = await readNativeStoreNames(name)
    expect(stores).toContain('references')
    expect(stores).not.toContain('masterWorks')
    expect(stores).not.toContain('masterChunkAnalysis')
    expect(stores).not.toContain('masterChapterBeats')
    expect(stores).not.toContain('masterStyleMetrics')
    expect(stores).not.toContain('masterInsights')
  })
})

function readNativeStoreNames(name: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name)
    req.onsuccess = () => {
      const database = req.result
      const stores = [...database.objectStoreNames]
      database.close()
      resolve(stores)
    }
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('DB read blocked'))
  })
}
