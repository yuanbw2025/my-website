/**
 * R-1: deleteGroup 事务作用域完整性
 *
 * 对应 MASTER-BLUEPRINT §4.0.1 / GPT-5.5 审查 + 内部审计 P0-1
 *
 * 反例:
 *   旧代码 deleteGroup 的 db.transaction 表清单只声明 9 张,
 *   但事务体内访问了 historicalTimelineEvents/historicalKeywords/
 *   codexEntries/codexCategories 这些未声明的表 → Dexie 抛错。
 *
 * 期望(P0-1 修复后):
 *   ① deleteGroup 不抛错
 *   ② 该 worldGroupId 在所有 worldScoped 表中无残留
 *
 * 跑法:
 *   npm test -- R-01
 *
 * 注意:这是给 5.5 / 接手者参考的"反例测试样板"。其他反例测试(R-2 ~ R-17)
 *      请参考此文件结构,按同样模式编写。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '../../src/lib/db/schema'

describe('R-01: deleteGroup 事务作用域完整性', () => {
  beforeEach(async () => {
    // 每个测试用例前清空数据库,保证隔离
    await db.delete()
    await db.open()
  })

  afterEach(async () => {
    // 释放
    db.close()
  })

  it('准备:能正常建项目 + 多世界(基础设施检查)', async () => {
    const now = Date.now()

    const projectId = await db.projects.add({
      name: 'R-01 测试项目',
      genre: 'fantasy',
      description: '',
      targetWordCount: 0,
      enableMultiWorld: true,
      createdAt: now,
      updatedAt: now,
    } as any)

    expect(projectId).toBeTypeOf('number')
    expect(projectId).toBeGreaterThan(0)

    const primaryId = await db.worldGroups.add({
      projectId: projectId as number,
      name: '主世界',
      type: 'primary',
      order: 0,
      createdAt: now,
      updatedAt: now,
    } as any)

    const sideId = await db.worldGroups.add({
      projectId: projectId as number,
      name: '斗破',
      type: 'parallel',
      order: 1,
      createdAt: now,
      updatedAt: now,
    } as any)

    expect(primaryId).toBeTypeOf('number')
    expect(sideId).toBeTypeOf('number')
    expect(sideId).not.toBe(primaryId)
  })

  /**
   * 核心反例测试:
   *
   * P0-1 修复前 → 此测试因 Dexie 事务作用域错误而抛 NotFoundError
   * P0-1 修复后 → 此测试通过(无残留)
   *
   * 实施者(5.5)在修 P0-1 时跑这个测试自检:
   *   - 修复前:`npm test -- R-01` 应该看到 fail
   *   - 修复后:`npm test -- R-01` 应该全绿
   */
  it.skip('[待 P0-1 修复后启用] 删除非主世界后,所有 worldScoped 表中无该 wgId 残留', async () => {
    // 此测试当前 .skip,因为 deleteGroup 现在会抛事务作用域错。
    // 实施者修完 P0-1 后,把 .skip 改成 .it,跑通即说明 P0-1 真修对了。
    //
    // 实施步骤(在 5.5 的 P0-1 PR 中完成):
    //   1. 修 src/stores/world-group.ts:88 事务声明
    //   2. 把这里的 .skip 删掉
    //   3. npm test -- R-01 应通过
    //   4. 在 PR 描述中粘贴测试输出作为验证证据

    const now = Date.now()
    const projectId = await db.projects.add({
      name: 'test', genre: '', description: '', targetWordCount: 0,
      enableMultiWorld: true, createdAt: now, updatedAt: now,
    } as any) as number

    const sideWg = await db.worldGroups.add({
      projectId, name: '斗破', type: 'parallel', order: 1,
      createdAt: now, updatedAt: now,
    } as any) as number

    // 在副世界下塞数据(覆盖所有 worldScoped 表)
    await db.worldviews.add({ projectId, worldGroupId: sideWg, createdAt: now, updatedAt: now } as any)
    await db.powerSystems.add({ projectId, worldGroupId: sideWg, name: '修真', description: '', levels: '[]', rules: '', createdAt: now, updatedAt: now } as any)
    await db.historicalTimelineEvents.add({ projectId, worldGroupId: sideWg, date: '元朝', title: '建立', description: '', type: 'event', isHistorical: true, createdAt: now, updatedAt: now } as any)
    await db.historicalKeywords.add({ projectId, worldGroupId: sideWg, term: '武林', category: 'general', description: '', createdAt: now, updatedAt: now } as any)
    await db.codexEntries.add({ projectId, worldGroupId: sideWg, categoryId: 0, name: '玄铁', fields: '{}', refs: '{}', createdAt: now, updatedAt: now } as any)

    // 动态 import store(避免顶层 import 时 store 初始化干扰其它测试)
    const { useWorldGroupStore } = await import('../../src/stores/world-group')

    // P0-1 修复后:这一行应不抛错
    await expect(useWorldGroupStore.getState().deleteGroup(sideWg)).resolves.not.toThrow()

    // 断言:该 wgId 在所有 worldScoped 表中无残留
    const checks: Record<string, number> = {
      worldviews: await db.worldviews.where('worldGroupId').equals(sideWg).count(),
      powerSystems: await db.powerSystems.where('worldGroupId').equals(sideWg).count(),
      historicalTimelineEvents: await db.historicalTimelineEvents.where('worldGroupId').equals(sideWg).count(),
      historicalKeywords: await db.historicalKeywords.where('worldGroupId').equals(sideWg).count(),
      codexEntries: await db.codexEntries.where('worldGroupId').equals(sideWg).count(),
    }

    for (const [table, count] of Object.entries(checks)) {
      expect(count, `${table} 中应无 worldGroupId=${sideWg} 的残留`).toBe(0)
    }
  })
})
