(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.PantryEngine = factory()
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SIZE = 7
  const SHAPES = [
    [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [1, 1], [2, 1]]
  ]
  function rotate(cells) {
    const turned = cells.map(([x, y]) => [-y, x])
    const minX = Math.min(...turned.map(p => p[0]))
    const minY = Math.min(...turned.map(p => p[1]))
    return turned.map(([x, y]) => [x - minX, y - minY])
  }
  function dateKey(date = new Date()) {
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)) }
  class Game {
    constructor(seed, shapePoolSizes = null, { fixedOrientation = false, gravityReady = false, rescueReady = false } = {}) {
      this.randomState = (Number(seed) >>> 0) || 1
      this.shapePoolSizes = shapePoolSizes
      this.fixedOrientation = fixedOrientation
      this.gravityReady = gravityReady
      this.rescueReady = rescueReady
      this.board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
      this.score = 0
      this.lines = 0
      this.combo = 0
      this.moves = 0
      this.last = null
      this.tray = []
      this.refill()
    }
    random() {
      let x = this.randomState
      x ^= x << 13; x ^= x >>> 17; x ^= x << 5
      this.randomState = x >>> 0
      return this.randomState / 4294967296
    }
    refill() {
      this.tray = Array.from({ length: 3 }, (_, index) => {
        const poolSize = this.shapePoolSizes?.[index] || SHAPES.length
        let cells = clone(SHAPES[Math.floor(this.random() * poolSize)])
        const turns = Math.floor(this.random() * 4)
        for (let n = 0; n < turns; n++) cells = rotate(cells)
        return { cells, color: 1 + Math.floor(this.random() * 4) }
      })
    }
    canPlace(cells, x, y) {
      return cells.every(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < SIZE && y + dy < SIZE && !this.board[y + dy][x + dx])
    }
    rotate(index) {
      if (!this.fixedOrientation && this.tray[index]) this.tray[index].cells = rotate(this.tray[index].cells)
    }
    hasMoves() {
      return this.tray.some(piece => {
        if (!piece) return false
        let cells = piece.cells
        for (let turn = 0; turn < (this.fixedOrientation ? 1 : 4); turn++) {
          for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (this.canPlace(cells, x, y)) return true
          cells = rotate(cells)
        }
        return false
      })
    }
    clearLines(board, cleared) {
      const rows = [], columns = []
      for (let i = 0; i < SIZE; i++) {
        if (board[i].every(Boolean)) rows.push(i)
        if (board.every(row => row[i])) columns.push(i)
      }
      for (let cy = 0; cy < SIZE; cy++) for (let cx = 0; cx < SIZE; cx++) {
        if (rows.includes(cy) || columns.includes(cx)) { cleared.push([cx, cy, board[cy][cx]]); board[cy][cx] = 0 }
      }
      return rows.length + columns.length
    }
    fallDown(board) {
      for (let x = 0; x < SIZE; x++) {
        let bottom = SIZE - 1
        for (let y = SIZE - 1; y >= 0; y--) {
          if (board[y][x]) board[bottom--][x] = board[y][x]
        }
        while (bottom >= 0) board[bottom--][x] = 0
      }
    }
    previewGravity() {
      if (!this.gravityReady) return null
      const board = this.board.map(row => row.slice())
      const cleared = []
      let count = 0, chain
      do {
        this.fallDown(board)
        chain = this.clearLines(board, cleared)
        count += chain
      } while (chain)
      if (!board.some((row, y) => row.some((color, x) => color !== this.board[y][x]))) return null
      return { board, count, cleared }
    }
    remember() {
      this.last = clone({
        board: this.board, tray: this.tray, score: this.score, lines: this.lines, combo: this.combo,
        moves: this.moves, randomState: this.randomState, gravityReady: this.gravityReady, rescueReady: this.rescueReady
      })
    }
    scoreClear(count, placedCells = 0) {
      this.combo = count ? this.combo + 1 : 0
      const gained = placedCells * 5 + count * 100 + Math.max(0, count - 1) * 50 + Math.max(0, this.combo - 1) * 25
      this.score += gained
      this.lines += count
      return gained
    }
    useGravity() {
      const preview = this.previewGravity()
      if (!preview) return null
      this.remember()
      this.board = preview.board
      this.gravityReady = false
      const { count, cleared } = preview
      return { count, cleared, gained: this.scoreClear(count), gravity: true, over: !this.hasMoves() }
    }
    rescueBoard() {
      if (!this.rescueReady || this.hasMoves()) return null
      let best = null
      for (const piece of this.tray) {
        if (!piece) continue
        const width = Math.max(...piece.cells.map(([x]) => x)) + 1
        const height = Math.max(...piece.cells.map(([, y]) => y)) + 1
        for (let y = 0; y <= SIZE - height; y++) for (let x = 0; x <= SIZE - width; x++) {
          const blocked = piece.cells.map(([dx, dy]) => [x + dx, y + dy, this.board[y + dy][x + dx]])
            .filter(([, , color]) => color)
          if (!best || blocked.length < best.length) best = blocked
        }
      }
      if (!best?.length) return null
      this.remember()
      this.rescueReady = false
      for (const [x, y] of best) this.board[y][x] = 0
      return best
    }
    spendTimeRescue() {
      if (!this.rescueReady) return false
      this.rescueReady = false
      if (this.last) this.last.rescueReady = false
      return true
    }
    place(index, x, y) {
      const piece = this.tray[index]
      if (!piece || !this.canPlace(piece.cells, x, y)) return null
      this.remember()
      piece.cells.forEach(([dx, dy]) => { this.board[y + dy][x + dx] = piece.color })
      const cleared = []
      const count = this.clearLines(this.board, cleared)
      const gained = this.scoreClear(count, piece.cells.length)
      this.moves++
      this.tray[index] = null
      if (this.tray.every(p => !p)) this.refill()
      return { gained, count, cleared, over: !this.hasMoves() && !this.previewGravity() }
    }
    undo() {
      if (!this.last) return false
      Object.assign(this, this.last)
      this.last = null
      return true
    }
  }
  return { Game, SIZE, rotate, dateKey }
})
