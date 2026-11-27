const test = require('node:test')
const assert = require('node:assert/strict')
const { FindGame, CATEGORIES, LEVELS } = require('../find-game')

test('每局生成 15 件物品，三类各 5 件', () => {
  const game = new FindGame(12345, 1)
  assert.equal(game.items.length, 15)
  CATEGORIES.forEach(category => {
    const items = game.items.filter(item => item.category === category.id)
    assert.equal(items.length, 5)
    assert.equal(game.progress(category.id).found, 0)
  })
})

test('物品位置不重复', () => {
  const game = new FindGame(98765, 1)
  const spots = new Set(game.items.map(item => `${item.spot.x},${item.spot.y}`))
  assert.equal(spots.size, 15)
})

test('每件物品都落在俯视垫子范围内', () => {
  const game = new FindGame(4321, 1)
  const mat = { x: 28, y: 310, right: 347, bottom: 710 }
  assert.ok(game.items.every(item =>
    item.spot.x >= mat.x &&
    item.spot.y >= mat.y &&
    item.spot.x + item.spot.w <= mat.right &&
    item.spot.y + item.spot.h <= mat.bottom
  ))
})

test('俯视摆放带轻微旋转且幅度受限', () => {
  const game = new FindGame(5678, 1)
  assert.ok(game.items.every(item => typeof item.rot === 'number' && Math.abs(item.rot) <= .35))
  assert.ok(new Set(game.items.map(item => item.rot)).size > 1)
})

test('每类第一件被前景杂物半遮挡', () => {
  const game = new FindGame(1122, 1)
  const covered = game.items.filter(item => item.covered)
  assert.equal(covered.length, 3)
  assert.deepEqual(covered.map(item => item.coverSide).sort(), ['bottom', 'left', 'right'])
})

test('同一随机种子生成相同布局', () => {
  const a = new FindGame(2468, 2)
  const b = new FindGame(2468, 2)
  assert.deepEqual(a.items.map(item => item.id), b.items.map(item => item.id))
})

test('收集同一件物品只生效一次，全部找齐后 complete', () => {
  const game = new FindGame(13579, 1)
  const first = game.items[0]
  assert.equal(game.collect(first.id).ok, true)
  assert.equal(game.collect(first.id).ok, false)
  assert.equal(game.progress(first.category).found, 1)
  game.items.forEach(item => game.collect(item.id))
  assert.equal(game.complete, true)
  assert.equal(game.filled, 6)
  assert.equal(game.tray.length, 0)
  assert.equal(game.unfound().length, 0)
})

test('装满后补箱，满托盘仍可提交当前箱子需要的物品', () => {
  const game = new FindGame(42)
  const firstBox = game.boxes[0]
  const matching = game.items.filter(item => item.category === firstBox.category)
  matching.slice(0, 2).forEach(item => assert.equal(game.collect(item.id).ok, true))
  assert.equal(game.filled, 1)
  assert.notEqual(game.boxes[0], firstBox)
  game.trayCapacity = 0
  const next = game.unfound().find(item => game.boxes.some(box => box?.category === item.category))
  assert.equal(game.collect(next.id).ok, true)
  assert.equal(game.expandTray(), true)
  assert.equal(game.trayCapacity, 7)
  assert.equal(game.expandTray(), false)
})

test('十二关可按当前箱子需求完成，且遮挡和托盘容量随关卡变化', () => {
  assert.equal(LEVELS.length, 12)
  LEVELS.forEach((level, index) => {
    const game = new FindGame(17041 + (index + 1) * 7919, index + 1)
    assert.equal(game.trayCapacity, level.slots)
    assert.equal(game.items.filter(item => item.covered).length, level.covers * 3)
    for (let step = 0; step < 15; step++) {
      const next = game.unfound().find(item => game.boxes.some(box => box?.category === item.category))
      assert.ok(next, `第 ${index + 1} 关应有可装箱物品`)
      assert.equal(game.collect(next.id).ok, true)
    }
    assert.equal(game.filled, 6)
    assert.equal(game.complete, true)
  })
})
