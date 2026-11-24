const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Game, rotate, dateKey } = require('../engine')

test('同一种子产生相同的方块序列', () => {
  const a = new Game(20261124), b = new Game(20261124)
  for (let n = 0; n < 50; n++) {
    assert.deepEqual(a.tray, b.tray)
    a.refill(); b.refill()
  }
})

test('连续旋转四次回到原形，不能越界或覆盖已有方块', () => {
  const original = [[0, 0], [0, 1], [1, 1]]
  let cells = original
  for (let i = 0; i < 4; i++) cells = rotate(cells)
  assert.deepEqual(cells, original)
  const game = new Game(1)
  assert.equal(game.canPlace(original, -1, 0), false)
  assert.equal(game.canPlace(original, 6, 6), false)
  game.board[1][1] = 1
  assert.equal(game.canPlace(original, 0, 0), false)
})

test('同时清除行列，交叉格只清理一次', () => {
  const game = new Game(1)
  for (let i = 1; i < 7; i++) { game.board[0][i] = 1; game.board[i][0] = 2 }
  game.tray = [{ cells: [[0, 0]], color: 3 }, null, null]
  const result = game.place(0, 0, 0)
  assert.equal(result.count, 2)
  assert.equal(result.cleared.length, 13)
  assert.equal(result.gained, 255)
  assert.ok(game.board.every(row => row.every(value => !value)))
})

test('无效放置不改变状态，撤回能恢复补货前的棋盘及随机序列', () => {
  const game = new Game(5)
  game.tray = [{ cells: [[0, 0]], color: 1 }, null, null]
  const before = JSON.stringify(game)
  assert.equal(game.place(0, -1, 0), null)
  assert.equal(JSON.stringify(game), before)
  game.place(0, 0, 0)
  const after = JSON.stringify({ tray: game.tray, randomState: game.randomState })
  assert.equal(game.undo(), true)
  assert.equal(game.score, 0)
  assert.equal(game.board[0][0], 0)
  assert.equal(game.undo(), false)
  game.place(0, 0, 0)
  assert.equal(JSON.stringify({ tray: game.tray, randomState: game.randomState }), after)
})

test('死局检查考虑旋转后的可放位置', () => {
  const game = new Game(1)
  game.board = Array.from({ length: 7 }, () => Array(7).fill(1))
  game.board[0][0] = 0; game.board[1][0] = 0
  game.tray = [{ cells: [[0, 0], [1, 0]], color: 1 }, null, null]
  assert.equal(game.hasMoves(), true)
  game.board[1][0] = 1
  assert.equal(game.hasMoves(), false)
})

test('日期键使用本地日历日期', () => {
  assert.equal(dateKey(new Date(2026, 10, 24)), '20261124')
})
