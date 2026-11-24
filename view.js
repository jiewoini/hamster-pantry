(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cat-care'))
  else root.PantryView = factory(root.CatCare)
})(typeof globalThis !== 'undefined' ? globalThis : this, function ({ CatCare, ITEMS, COATS, FAVORITES, BALL_COLORS }) {
  const COLORS = ['#e9e2d7', '#e8a457', '#86aa8b', '#9c9bc7', '#dc8d80']
  const W = 375, H = 800, CELL = 43, BX = 37, BY = 222
  const DRAG_GAP = 36
  const LEVEL_KEY = 'pantry_unlocked_level_v1'
  const PANTRY_REWARDS = ['food', 'water', 'box', 'scarf']
  const COAT_ENTRIES = Object.entries(COATS)
  const COATS_PER_PAGE = 4
  const BOX_INTRO_MS = 3800
  const PET_GREETING_MS = { approach: 3900, sniff: 2850, glance: 1650, settle: 2200 }
  const BAG_ROUNDS = [1, 2, 3]
  const BAG_SWAP_MS = [820, 690, 570]
  const BAG_PAIRS = [[0, 1], [1, 2], [0, 2]]
  const RUG_SWIPE_ZONE = { x: 70, y: 280, w: 233, h: 64 }
  const WEATHER = {
    sunny: { label: '晴', sky: '#b9d8d6', light: '#fff3bc58' },
    cloudy: { label: '阴', sky: '#b8c6cb', light: '#f8e9d029' },
    rain: { label: '雨', sky: '#8ea6ae', light: '#d4e1de31' }
  }
  const WEATHER_CYCLE = Object.keys(WEATHER)
  const WEATHER_INTERVAL = 30 * 60 * 1000
  const GAME_NAME = '猫爪收纳局'
  const HEALTH_NOTICE = [
    '抵制不良游戏，拒绝盗版游戏。',
    '注意自我保护，谨防受骗上当。',
    '适度游戏益脑，沉迷游戏伤身。',
    '合理安排时间，享受健康生活。'
  ]
  const AGE_RATING = '8+'
  const AGE_NOTE = '本游戏为卡通风格的轻度收纳与养猫游戏，画面简约，无写实内容，无陌生人社交，无对抗玩法，适合 8 周岁及以上玩家。未满 8 周岁不建议游玩。'
  class PantryView {
    constructor(canvas, engine, platform) {
      this.canvas = canvas
      this.ctx = canvas.getContext('2d')
      this.engine = engine
      this.platform = platform
      this.state = 'home'
      this.mode = 'classic'
      const savedLevel = Number(platform.read(LEVEL_KEY))
      this.legacyLevel = Number.isSafeInteger(savedLevel) && savedLevel > 0 ? savedLevel : 1
      this.care = new CatCare(platform)
      if (!this.care.state.profile) this.editProfile()
      this.selected = 0
      this.buttons = []
      this.effects = []
      this.message = ''
      this.messageUntil = 0
      this.pointer = null
      this.running = false
      if (this.state === 'home') this.goHome()
      this.compliance = true
      this.ageNoteOpen = false
      this.game = new engine.Game(12345)
      this.resume()
    }
    resize(width, height, ratio = 1) {
      this.width = width; this.height = height; this.ratio = ratio
      this.canvas.width = Math.round(width * ratio)
      this.canvas.height = Math.round(height * ratio)
      this.scale = Math.min(width / W, height / H)
      this.offsetX = (width - W * this.scale) / 2
      this.offsetY = (height - H * this.scale) / 2
      this.render()
    }
    resume() {
      if (this.running) return
      this.running = true
      const tick = () => {
        if (!this.running) return
        if (this.state === 'home') this.updateCatHome(Date.now())
        if (this.scale) this.render()
        this.frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(tick) : setTimeout(tick, 32)
      }
      tick()
    }
    suspend() {
      this.running = false
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame)
      else clearTimeout(this.frame)
      this.cancel()
      if (this.state === 'playing') this.state = 'paused'
    }
    key() { return this.mode === 'daily' ? `pantry_daily_${this.day}` : 'pantry_classic_v1' }
    get unlockedLevel() { return Math.max(this.legacyLevel, this.care.completed('pantry') + 1) }
    get levelGoal() { return this.unlockedLevel <= 4 ? 1 : 2 }
    get levelReward() {
      const { box, scarf } = this.care.state.inventory
      if (this.unlockedLevel >= 3 && !box) return 'box'
      if (this.unlockedLevel >= 4 && !scarf) return 'scarf'
      return this.unlockedLevel <= 4 ? PANTRY_REWARDS[this.unlockedLevel - 1] : PANTRY_REWARDS[(this.unlockedLevel - 5) % 2]
    }
    start(mode) {
      this.mode = mode
      this.day = this.engine.dateKey()
      const seed = mode === 'daily' ? Number(this.day) : (Date.now() ^ Math.floor(Math.random() * 1000000)) >>> 0
      this.game = new this.engine.Game(seed, mode === 'classic')
      this.state = 'playing'; this.selected = 0; this.pointer = null; this.effects = []
      this.best = Number(this.platform.read(this.key())) || 0
      this.notify(mode === 'daily' ? '今天同一套方块，试着突破 800 分' : `清空 ${this.levelGoal} 行或列，带${ITEMS[this.levelReward].name}回家`)
    }
    notify(message) { this.message = message; this.messageUntil = Date.now() + 2300 }
    point(x, y) { return { x: (x - this.offsetX) / this.scale, y: (y - this.offsetY) / this.scale } }
    inside(p, b) { return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h }
    down(x, y) {
      const p = this.point(x, y)
      this.rugSwipe = this.canSmoothRug() && this.inside(p, RUG_SWIPE_ZONE)
        ? { ...p, distance: 0 }
        : null
      const button = this.buttons.slice().reverse().find(b => this.inside(p, b))
      if (button) { this.pressed = button; return }
      if (this.state !== 'playing') return
      if (p.y >= 554 && p.y <= 668) {
        const index = Math.floor((p.x - 24) / 109)
        if (index >= 0 && index < 3 && this.game.tray[index]) {
          this.selected = index
          this.pointer = { ...p, startX: p.x, startY: p.y, dragged: false }
        }
      } else if (p.x >= BX && p.x < BX + CELL * 7 && p.y >= BY && p.y < BY + CELL * 7) {
        this.pointer = { ...p, startX: p.x, startY: p.y, boardTap: true, dragged: false }
      }
    }
    move(x, y) {
      if (this.rugSwipe) {
        const p = this.point(x, y)
        this.rugSwipe.distance = this.rugSwipeDistance(p)
      }
      if (!this.pointer || this.state !== 'playing') return
      const p = this.point(x, y)
      if (Math.hypot(p.x - this.pointer.startX, p.y - this.pointer.startY) > 8) this.pointer.dragged = true
      Object.assign(this.pointer, p)
    }
    placementPoint(pointer) {
      const piece = this.game.tray[this.selected]
      if (pointer.boardTap || !piece) return { x: pointer.x, y: pointer.y }
      const bottomRow = Math.max(...piece.cells.map(([, dy]) => dy))
      return { x: pointer.x, y: pointer.y - DRAG_GAP - (bottomRow + .5) * CELL }
    }
    up(x, y) {
      const p = this.point(x, y)
      if (this.rugSwipe) {
        const distance = this.rugSwipeDistance(p)
        this.rugSwipe = null
        if (distance >= 38 && this.canSmoothRug()) {
          this.pressed = null
          this.smoothRug()
          return
        }
      }
      if (this.pressed) {
        const b = this.pressed; this.pressed = null
        if (this.inside(p, b)) b.action()
        return
      }
      if (this.state !== 'playing' || !this.pointer) return
      this.move(x, y)
      const pointer = this.pointer
      this.pointer = null
      if (!pointer.boardTap && !pointer.dragged) return
      const target = this.placementPoint(pointer)
      const gx = Math.floor((target.x - BX) / CELL)
      const gy = Math.floor((target.y - BY) / CELL)
      const result = this.game.place(this.selected, gx, gy)
      if (!result) { this.notify('这里放不下，换个位置或旋转一下'); return }
      this.platform.write(this.key(), Math.max(this.best, this.game.score))
      this.best = Math.max(this.best, this.game.score)
      if (result.count) {
        this.platform.vibrate()
        this.notify(`${result.count > 1 ? '漂亮！' : '收好啦！'}清空 ${result.count} 条 · +${result.gained}`)
        this.effects = result.cleared.map(([cx, cy, color]) => ({ x: BX + cx * CELL + 21, y: BY + cy * CELL + 21, color, time: Date.now() }))
      }
      this.selected = this.game.tray.findIndex(Boolean)
      if (this.mode === 'classic' && this.game.lines >= this.levelGoal) {
        this.clearedLevel = this.unlockedLevel
        this.earnedItem = this.levelReward
        this.care.grant('pantry', this.clearedLevel, this.earnedItem)
        this.state = 'cleared'
      } else if (result.over) this.state = 'over'
    }
    cancel() { this.pointer = null; this.pressed = null; this.rugSwipe = null }
    canSmoothRug(now = Date.now()) {
      return this.state === 'home' && this.care.state.rugRumpled && this.boxIntroAt === undefined &&
        !(this.catAction === 'ball' && this.messageUntil > now)
    }
    rugSwipeDistance(point) {
      const dx = Math.abs(point.x - this.rugSwipe.x)
      const dy = Math.abs(point.y - this.rugSwipe.y)
      return dy <= 34 ? dx : 0
    }
    smoothRug() {
      if (!this.care.smoothRug()) return
      this.catAction = 'rug'
      this.catActionX = 176
      this.catActionAt = Date.now()
      this.notify(`${this.catName}踩了两下，又趴回地毯上。`)
      this.messageUntil += 2200
    }
    undo() {
      if (!this.game.undo()) { this.notify('放下一块后，就能撤回这一步'); return }
      this.selected = this.game.tray.findIndex(Boolean)
      this.state = 'playing'; this.effects = []; this.notify('已撤回上一步')
    }
    round(x, y, w, h, radius, color, stroke) {
      const c = this.ctx, r = Math.min(radius, w / 2, h / 2)
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r)
      c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath()
      if (color) { c.fillStyle = color; c.fill() }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke() }
    }
    text(text, x, y, size = 14, color = '#514a41', align = 'left', bold = false) {
      const c = this.ctx; c.fillStyle = color; c.font = `${bold ? 'bold ' : ''}${size}px "Microsoft YaHei", "PingFang SC", sans-serif`
      c.textAlign = align; c.textBaseline = 'middle'; c.fillText(String(text), x, y)
    }
    button(label, x, y, w, h, action, primary = false) {
      this.round(x, y, w, h, 17, primary ? '#657f5a' : '#fffdf8')
      this.text(label, x + w / 2, y + h / 2, 15, primary ? '#fff' : '#657356', 'center', true)
      this.buttons.push({ x, y, w, h, action })
    }
    get catName() { return this.care.state.profile?.name || '团子' }
    cat(x, y, size = 1, action = '', coat = this.care.state.profile?.coat || 'orange', portrait = false) {
      const c = this.ctx; c.save(); c.translate(x, y); c.scale(size, size)
      const ellipse = (cx, cy, rx, ry, color) => { c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = color; c.fill() }
      const triangle = (x1, y1, x2, y2, x3, y3, color) => {
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath()
        c.fillStyle = color; c.fill()
      }
      const { fur, edge: outline, cream, mark, pattern, eyes = '#816b59', round, fluffy, folded, tallEars } = COATS[coat] || COATS.orange
      const golden = coat === 'golden'
      const patched = coat === 'tuxedo' || coat === 'calico' || pattern === 'patch'
      const dark = coat === 'calico' ? '#766060' : mark
      const boxed = action === 'box' || action === 'boxNap' || action === 'boxTurn'
      if (boxed) this.round(-51, 16, 102, 59, 8, '#b48155')
      else {
        c.beginPath(); c.moveTo(26, 48); c.bezierCurveTo(55, 62, 69, 42, 61, 33)
        c.lineCap = 'round'; c.lineWidth = 13; c.strokeStyle = outline; c.stroke()
        c.lineWidth = 10; c.strokeStyle = golden ? mark : patched || pattern === 'point' ? dark : fur; c.stroke()
        ellipse(0, 35, 35, 25, outline); ellipse(0, 34, 33, 24, coat === 'tuxedo' ? mark : fur)
        if (coat === 'calico') ellipse(20, 38, 11, 14, mark)
        ellipse(golden ? 0 : -3, 40, golden ? 25 : 21, 17, cream)
        ellipse(-20, 55, 14, 8, outline); ellipse(20, 55, 14, 8, outline)
        ellipse(-20, 54, 12, 7, cream); ellipse(20, 54, 12, 7, cream)
      }
      const headY = action === 'boxTurn' ? 11 : action === 'boxNap' ? 15 :
        action === 'sniff' || action === 'reach' || action === 'food' || action === 'water' ? 11 : 0
      c.save(); c.translate(0, headY)
      if (portrait && action === 'pet' && coat === 'tuxedo') c.rotate(-.12)
      if (action === 'boxNap') c.rotate(-.12)
      if (action === 'boxTurn') c.rotate(.23)
      for (const side of [-1, 1]) {
        c.save(); c.scale(side, 1)
        if (golden) { c.translate(9, -8); c.scale(.75, .72) }
        const earTop = tallEars ? -53 : -43
        c.beginPath(); c.moveTo(11, -23)
        c.quadraticCurveTo(24, folded ? -32 : earTop + 1, 34, folded ? -30 : earTop)
        c.quadraticCurveTo(41, folded ? -32 : earTop + 1, 40, -8)
        c.closePath(); c.fillStyle = patched || pattern === 'point' ? (coat === 'calico' && side < 0 ? mark : dark) : fur; c.fill()
        c.lineWidth = 1.7; c.strokeStyle = outline; c.stroke()
        if (!folded) triangle(21, -24, 33, earTop + 7, 35, -15, '#e59387')
        c.restore()
      }
      const faceWidth = golden ? 47 : round ? 45 : 43
      if (fluffy) {
        ellipse(-30, 19, 15, 14, outline); ellipse(30, 19, 15, 14, outline)
        ellipse(-30, 19, 13, 12, fur); ellipse(30, 19, 13, 12, fur)
      }
      ellipse(0, 1, faceWidth, 31, outline); ellipse(0, 1, faceWidth - 1.5, 29.5, fur)
      if (pattern === 'shaded') {
        c.save()
        c.beginPath(); c.ellipse(0, 1, faceWidth - 1.5, 29.5, 0, 0, Math.PI * 2); c.clip()
        const shade = c.createLinearGradient(0, -29, 0, golden ? 30 : 11)
        shade.addColorStop(0, mark)
        if (golden) shade.addColorStop(.48, fur)
        shade.addColorStop(1, golden ? cream : fur)
        c.fillStyle = shade; c.fillRect(-faceWidth, -30, faceWidth * 2, golden ? 61 : 41)
        c.restore()
      }
      if (patched) {
        c.save(); c.beginPath(); c.ellipse(0, 1, 41.5, 29.5, 0, 0, Math.PI * 2); c.clip()
        ellipse(-27, -18, coat === 'tuxedo' ? 29 : 22, 26, mark)
        ellipse(30, -21, 24, coat === 'tuxedo' ? 29 : 18, dark)
        if (coat === 'tuxedo') ellipse(33, 13, 10, 14, mark)
        c.restore()
      }
      if (golden) {
        ellipse(0, 21, 25, 9, cream)
        ellipse(-8, 13, 11, 8, cream); ellipse(8, 13, 11, 8, cream)
      } else {
        ellipse(-13, 15, 22, 13, cream); ellipse(13, 15, 22, 13, cream)
      }
      if (pattern === 'point') {
        ellipse(0, 6, 30, 21, mark)
        if (coat === 'snowshoe') ellipse(0, 12, 8, 12, cream)
      }
      if (coat === 'orange' || pattern === 'striped' || pattern === 'wrinkled') {
        this.round(-2.2, -28, 4.4, 13, 2, mark)
        ellipse(-9, -24, 2, 6, mark); ellipse(9, -24, 2, 6, mark)
      }
      const relaxed = action === 'boxNap' || action === 'boxTurn' || action === 'pet' || action === 'food' || action === 'water' || action === 'nap' || (!portrait && this.care.state.mood >= 75)
      for (const side of [-1, 1]) {
        c.save(); c.scale(side, 1)
        if (pattern === 'striped') {
          this.round(32, -7, 8, 3, 2, mark)
          this.round(34, -1, 7, 3, 2, mark)
        }
        if (pattern === 'spotted') {
          ellipse(26, -16, 4, 2.5, mark)
          ellipse(34, -9, 2.5, 2, mark)
          ellipse(31, 2, 2, 1.6, mark)
        }
        if (!golden || action === 'pet') ellipse(27, 10, 5, 2.7, action === 'pet' ? '#de8a7b' : '#eaa187')
        c.lineCap = 'round'; c.strokeStyle = '#674535'; c.lineWidth = 1.8
        if (relaxed) {
          c.beginPath(); c.moveTo(10, 0); c.quadraticCurveTo(16, -6, 22, 0); c.stroke()
        } else if (golden) {
          ellipse(18, -1, 10, 9.7, '#554530')
          ellipse(18, -1, 8.4, 8.3, eyes)
          ellipse(18, -1, 4.7, 6.1, '#302c27')
          ellipse(15.8, -4.3, 2.3, 2.2, '#fff8df')
          ellipse(20.6, 2.4, 1, 1, '#edebc6')
        } else {
          ellipse(16, -2, 7.4, 8.4, eyes)
          ellipse(16, -2, 4.8, 6.5, '#45372e')
          ellipse(14.5, -4, 2, 2.2, '#fff9ec')
          ellipse(18.5, 1, 1, 1, '#f7d69e')
        }
        c.beginPath(); c.moveTo(31, 12); c.lineTo(46, 9); c.moveTo(32, 16); c.lineTo(46, 18); c.stroke()
        c.beginPath(); c.moveTo(0, 11); c.quadraticCurveTo(3, 18, 7, 14); c.stroke()
        c.restore()
      }
      if (golden) {
        ellipse(0, 8, 4.8, 3.3, '#65483a')
        ellipse(0, 7.9, 3.4, 2.2, '#bf8173')
      } else triangle(-4, 7, 4, 7, 0, 11, '#ac655a')
      if (!portrait && this.care.state.scarf && !boxed) {
        triangle(-21, 26, 21, 26, 5, 45, '#658b83')
        ellipse(3, 32, 2, 2, '#f2dab0')
      }
      c.restore()
      if (boxed) {
        this.round(-51, 17, 102, 17, 4, '#d4a675')
        this.round(-17, 44, 34, 14, 4, '#e4bd92')
        if (action === 'boxNap') this.text('z z', 39, -24, 12, '#796652', 'center', true)
      } else if (action === 'reach') {
        ellipse(36, 51, 13, 7, outline)
        ellipse(36, 50, 11, 6, cream)
      } else if (action === 'food' || action === 'water') {
        const water = action === 'water'
        this.round(-28, 47, 56, 17, 7, water ? '#608b9b' : '#8a614a')
        ellipse(0, 48, 26, 5, water ? '#a2d6db' : '#c49667')
      }
      c.restore()
    }
    block(x, y, size, color, alpha = 1) {
      const c = this.ctx; c.save(); c.globalAlpha = alpha
      this.round(x + 2, y + 3, size - 4, size - 4, 8, COLORS[color])
      this.round(x + 6, y + 6, size - 12, Math.max(3, size * .15), 3, 'rgba(255,255,255,.25)')
      c.restore()
    }
    drawBoard() {
      this.round(BX - 9, BY - 9, CELL * 7 + 18, CELL * 7 + 18, 22, '#ddd3c4')
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        this.round(BX + x * CELL + 2, BY + y * CELL + 3, CELL - 4, CELL - 4, 8, '#f6f1e8')
        if (this.game.board[y][x]) this.block(BX + x * CELL, BY + y * CELL, CELL, this.game.board[y][x])
      }
      const piece = this.game.tray[this.selected]
      if (this.pointer && piece && (this.pointer.dragged || this.pointer.boardTap)) {
        const target = this.placementPoint(this.pointer)
        const x = Math.floor((target.x - BX) / CELL)
        const y = Math.floor((target.y - BY) / CELL)
        const valid = this.game.canPlace(piece.cells, x, y)
        if (this.pointer.boardTap || !valid) piece.cells.forEach(([dx, dy]) => {
          if (x + dx >= 0 && x + dx < 7 && y + dy >= 0 && y + dy < 7) {
            this.round(BX + (x + dx) * CELL + 3, BY + (y + dy) * CELL + 4, CELL - 6, CELL - 6, 8, valid ? '#b6c6a0' : '#e6b3a6')
          }
        })
      }
      const now = Date.now()
      this.effects = this.effects.filter(p => now - p.time < 650)
      this.effects.forEach((p, index) => {
        const t = (now - p.time) / 650
        this.block(p.x - 10 + Math.sin(index * 3) * t * 25, p.y - 10 - t * 45, 20, p.color, 1 - t)
      })
    }
    drawDraggedPiece() {
      if (!this.pointer?.dragged || this.pointer.boardTap) return
      const piece = this.game.tray[this.selected]
      if (!piece) return
      const target = this.placementPoint(this.pointer)
      const gx = Math.floor((target.x - BX) / CELL)
      const gy = Math.floor((target.y - BY) / CELL)
      const snapped = this.game.canPlace(piece.cells, gx, gy)
      const x = snapped ? BX + gx * CELL : target.x - CELL / 2
      const y = snapped ? BY + gy * CELL : target.y - CELL / 2
      for (const [dx, dy] of piece.cells) {
        this.block(x + dx * CELL, y + dy * CELL, CELL, piece.color, .85)
      }
    }
    drawTray() {
      for (let index = 0; index < 3; index++) {
        const x = 24 + index * 109, piece = this.game.tray[index]
        this.round(x, 554, 103, 110, 20, index === this.selected ? '#fffdf8' : '#eee9df', index === this.selected ? '#b5bf9d' : null)
        if (!piece) { this.text('已收好', x + 51, 610, 12, '#b1aa9d', 'center'); continue }
        const width = Math.max(...piece.cells.map(p => p[0])) + 1
        const height = Math.max(...piece.cells.map(p => p[1])) + 1
        const size = Math.min(25, 86 / width, 83 / height)
        piece.cells.forEach(([dx, dy]) => this.block(x + (103 - width * size) / 2 + dx * size, 554 + (110 - height * size) / 2 + dy * size, size, piece.color))
      }
    }
    useItem(item) {
      const message = this.care.use(item)
      if (!message) return
      this.catAction = item
      this.catActionX = 184
      this.catActionAt = Date.now()
      const favoriteReaction = this.care.reactTo(item)
      this.notify(favoriteReaction ? this.catName + favoriteReaction : message.replace(/^团子/, () => this.catName))
    }
    editProfile() {
      const profile = this.care.state.profile
      this.draftCoat = profile?.coat || 'orange'
      this.draftName = profile?.name || '团子'
      this.coatPage = Math.max(0, Math.floor(COAT_ENTRIES.findIndex(([id]) => id === this.draftCoat) / COATS_PER_PAGE))
      this.coatReactionUntil = 0
      this.profileHint = ''
      this.state = 'profile'
    }
    editName() {
      if (this.naming) return
      this.naming = true
      this.platform.requestName(this.draftName, value => {
        this.naming = false
        if (typeof value !== 'string') return
        const name = value.trim()
        if (!name || [...name].length > 8 || /[\x00-\x1f\x7f]/.test(name)) {
          this.profileHint = '请输入 1 到 8 个字。'
          return
        }
        this.draftName = name
        this.profileHint = ''
      })
    }
    drawProfile() {
      const editing = Boolean(this.care.state.profile)
      this.text(GAME_NAME, 25, 38, 10, '#969d82', 'left', true)
      this.text(editing ? '小猫档案' : '选一只小猫', 25, 71, 35, '#454d38', 'left', true)
      this.text(editing ? '给小猫换个样子，或改个名字。' : '挑一只合眼缘的猫，带它回家。', 26, 110, 15, '#76695b')
      const first = this.coatPage * COATS_PER_PAGE
      const pages = Math.ceil(COAT_ENTRIES.length / COATS_PER_PAGE)
      COAT_ENTRIES.slice(first, first + COATS_PER_PAGE).forEach(([id, coat], index) => {
        const x = 25 + index % 2 * 168
        const y = 145 + Math.floor(index / 2) * 165
        const selected = id === this.draftCoat
        const reacting = selected && this.coatReactionUntil > Date.now()
        this.round(x, y, 157, 152, 21, coat.card, selected ? '#6b805b' : null)
        this.round(x + 19, y + 91, 117, 27, 14, 'rgba(92,66,45,.085)')
        this.cat(x + 75, y + 59 + (reacting ? Math.sin(Date.now() / 110) * 2 : 0), .86, reacting ? 'pet' : '', id, true)
        this.text(coat.label, x + 78.5, y + 132, 15, '#54483d', 'center', true)
        if (selected) {
          this.round(x + 122, y + 10, 24, 24, 12, '#6b805b')
          this.text('✓', x + 134, y + 22, 14, '#fffdf8', 'center', true)
        }
        this.buttons.push({ x, y, w: 157, h: 152, action: () => {
          this.draftCoat = id
          this.coatReactionUntil = Date.now() + 850
        } })
      })
      if (this.coatPage > 0) this.button('‹ 上一页', 25, 476, 91, 38, () => { this.coatPage-- })
      if (this.coatPage < pages - 1) this.button('下一页 ›', 259, 476, 91, 38, () => { this.coatPage++ })
      this.text(`${this.coatPage + 1} / ${pages} 页`, W / 2, 495, 14, '#657356', 'center')
      this.text(`已选 ${COATS[this.draftCoat].label}`, 27, 531, 14, '#514a41', 'left', true)
      this.round(25, 546, 325, 58, 17, '#fffdf8')
      this.text(this.draftName, 44, 575, 22, '#454d38', 'left', true)
      this.text('改名字 ›', 327, 575, 14, '#657356', 'right', true)
      this.buttons.push({ x: 25, y: 546, w: 325, h: 58, action: () => this.editName() })
      if (this.profileHint) this.text(this.profileHint, 27, 622, 13, '#9b5549')
      this.button(editing ? '保存档案' : '带它回家', 25, 641, 325, 58, () => {
        if (this.naming) return
        if (this.care.setProfile(this.draftCoat, this.draftName)) this.goHome()
        else this.profileHint = '请输入 1 到 8 个字。'
      }, true)
      if (editing) this.button('取消', 25, 711, 325, 44, () => this.goHome())
    }
    drawCatHome() {
      const titleSize = Math.min(30, 218 / ([...this.catName].length + 3))
      this.text(GAME_NAME, 26, 38, 10, '#969d82', 'left', true)
      this.text(`${this.catName}的猫窝`, 26, 66, titleSize, '#454d38', 'left', true)
      this.button('猫咪档案', 260, 47, 90, 37, () => this.editProfile())
      const favorite = this.care.state.favorite
      const favoriteLabel = this.care.state.favoriteKnown && FAVORITES[favorite]?.label
      this.text(favoriteLabel ? `喜欢 · ${favoriteLabel}` : '它喜欢什么？相处久一点就知道了。', 26, 92, 11, '#756856')
      const now = Date.now()
      const weather = this.roomWeather(now)
      const windowVisit = this.catAction === 'window' && this.messageUntil > now ? now - this.catActionAt : -1
      this.drawRoom(weather, now, windowVisit)
      this.text(`猫窝天气 · ${WEATHER[weather].label}`, 350, 92, 11, '#756856', 'right')
      const intro = this.boxIntroAt === undefined ? -1 : now - this.boxIntroAt
      const introducing = intro >= 0
      const reacting = this.messageUntil > now
      const greeting = !introducing && reacting && this.catAction === 'pet' && this.petScene
        ? this.petGreetingPose(now) : null
      const chasing = !introducing && reacting && this.catAction === 'ball'
      const settling = !introducing && reacting && this.catAction === 'rug'
      const watching = !introducing && reacting && this.catAction === 'window'
      const tidying = !introducing && reacting && this.catAction === 'crumbs'
      const settleWalk = settling ? Math.max(0, 1 - (now - this.catActionAt) / 850) : 0
      const roll = chasing ? Math.min(1, (now - this.catActionAt) / 1450) : 0
      const ballX = chasing ? 126 + 171 * (1 - (1 - roll) ** 2) : 310
      const onCushion = !introducing && !reacting && this.cushionNap
      const sleeping = !introducing && !reacting && !onCushion && this.boxNap
      const idle = !introducing && !reacting && !sleeping && !onCushion ? this.catIdlePose(now, weather) : null
      const action = introducing ? (intro >= 2450 ? 'reach' : intro >= 1250 ? 'sniff' : '') :
        reacting ? this.catAction : sleeping ? 'boxNap' : onCushion || favorite === 'pet' ? 'nap' : ''
      const boxed = action === 'box' || action === 'boxNap' || action === 'boxTurn'
      const bob = reacting ? Math.sin(now / 130) * 2 : sleeping || onCushion ? Math.sin(now / 550) : 0
      const catX = greeting ? greeting.x : introducing ? 184 + 28 * Math.min(1, intro / 1250) :
        boxed ? 228 : onCushion ? 115 : chasing ? ballX - 56 :
          reacting ? this.catActionX + 37 * settleWalk : idle.x
      if (this.care.state.cushionPlaced) this.drawCushion(47, 276, 135)
      if (this.care.count('box') && !boxed) {
        this.drawRoomBox(261, 265)
      }
      const rumpled = this.canSmoothRug(now)
      if (rumpled) this.drawRugFold(1 - Math.min(.94, (this.rugSwipe?.distance || 0) / 42))
      this.drawRoomShadow(catX + 2, greeting ? greeting.floor + 4 : onCushion ? 300 : 323, boxed ? 75 : 57, 8, '#76554145')
      if (greeting) {
        this.drawCatFromSide(greeting.x, greeting.floor, greeting.size, greeting.pose, greeting.direction, now)
      } else if (idle || onCushion || introducing || chasing || settling || watching || tidying) {
        const pose = watching ? 'window' : tidying ? 'sniff' : chasing ? (roll < 1 ? 'walk' : 'groom') :
          settleWalk ? 'walk' : onCushion || settling ? 'rest' :
          introducing ? (intro >= 2450 ? 'groom' : intro >= 1250 ? 'sniff' : 'walk') : idle.pose
        this.drawCatFromSide(catX, onCushion ? 296 : 319, onCushion ? 1.05 : 1.15, pose,
          introducing || chasing || tidying ? 1 : (idle?.direction || -1), now)
      } else this.cat(catX, 235 + bob, 1.45, action)
      if (!introducing && !reacting) this.buttons.push({ x: catX - 66, y: 170, w: 132, h: 155, action: () => {
        if (sleeping) {
          const choices = ['boxNap', 'boxTurn', 'box'].filter(response => response !== this.lastBoxResponse)
          this.catAction = choices[Math.floor(Math.random() * choices.length)]
          this.lastBoxResponse = this.catAction
          const reaction = this.care.reactTo('box')
          const note = this.catAction === 'boxNap' ? '耳朵动了一下，还是睡得很香。' :
            this.catAction === 'boxTurn' ? '翻了个身，换一边继续睡。' :
              reaction || '在纸箱里睁开眼，抬头看了看你。'
          this.notify(this.catName + note)
          return
        }
        this.catAction = 'pet'
        this.catActionAt = Date.now()
        const response = this.choosePetResponse(onCushion, idle?.pose)
        const duration = PET_GREETING_MS[response]
        this.petScene = {
          x: catX, floor: onCushion ? 296 : 319, size: onCushion ? 1.05 : 1.15,
          pose: onCushion ? 'rest' : idle.pose, direction: idle?.direction || -1,
          response, duration, favorite: response === 'approach' ? this.care.reactTo('pet') : ''
        }
        this.messageUntil = this.catActionAt + duration
      } })
      if (!introducing && !chasing) {
        this.buttons.push({ x: 45, y: 130, w: 86, h: 83, action: () => {
          this.catAction = 'window'
          this.catActionX = 114
          this.catActionAt = Date.now()
          this.notify(this.catName + (weather === 'rain' ? '盯着一滴雨慢慢滑下去。' : '竖起耳朵，听窗外的鸟叫。'))
        } })
      }
      if (!introducing && !chasing && action !== 'food' && (this.care.state.foodCrumbs || favorite === 'food' || tidying)) {
        this.drawFoodCorner(this.care.state.foodCrumbs)
        if (this.care.state.foodCrumbs) this.buttons.push({ x: 231, y: 294, w: 62, h: 43, action: () => {
          if (!this.care.cleanCrumbs()) return
          this.catAction = 'crumbs'
          this.catActionX = 204
          this.notify(`${this.catName}凑过来，闻了闻刚擦过的地板。`)
        } })
      }
      if (this.care.count('ball')) {
        this.drawYarnBall(ballX, 325, roll * 10, this.care.state.ballColor)
        if (!introducing && !chasing) this.buttons.push({
          x: ballX - 20, y: 305, w: 40, h: 36, action: () => this.useItem('ball')
        })
      }
      const roomNote = greeting ? this.catName + greeting.note : introducing
        ? (intro < 1250 ? '发现新纸箱，悄悄凑过去。' : intro < 2450 ? '低下头，闻了闻箱沿。' : '试探着伸出一只爪。')
        : reacting ? this.message : sleeping ? `${this.catName}在纸箱里睡着了。`
          : onCushion ? `${this.catName}${weather === 'sunny' ? '趴在软垫上晒太阳。' : '蜷在窗边的软垫上。'}` : `${this.catName}${idle.note}`
      const flash = Math.max(0, (this.photoFlashUntil || 0) - now)
      if (flash) this.round(24, 102, 327, 270, 25, `rgba(255,250,234,${flash / 400})`)
      const caption = flash ? '已把这一刻留进相册。' : !reacting && rumpled ? '地毯角翘起来了，左右轻划一下。' :
        !reacting && !introducing && this.care.state.foodCrumbs ? '碗边有碎屑，点一下收拾。' : roomNote
      const captionWidth = Math.min(295, [...caption].length * 12 + 24)
      this.round((W - captionWidth) / 2, 342, captionWidth, 24, 12, '#fff6e9')
      this.text(caption, W / 2, 354, 12, '#655548', 'center')
      this.button('相册', 269, 120, 64, 34, () => {
        this.albumPage = !this.care.state.boxPhoto && this.care.state.cushionPhoto ? 1 : 0
        this.state = 'album'
      })
      if ((sleeping && !this.care.state.boxPhoto) || (onCushion && !this.care.state.cushionPhoto)) {
        this.button('拍张照', 181, 120, 78, 34, () => {
          const saved = sleeping ? this.care.saveBoxPhoto(Date.now(), weather) : this.care.saveCushionPhoto(Date.now(), weather)
          if (saved) this.photoFlashUntil = Date.now() + 400
        }, true)
      }

      const stats = [
        ['满意度', this.care.state.mood, '#bd805c'],
        ['活跃度', this.care.state.energy, '#779565']
      ]
      stats.forEach(([label, value, color], index) => {
        const x = 25 + index * 168
        this.round(x, 389, 157, 61, 16, '#fffdf8')
        this.text(label, x + 13, 409, 13, '#514a41')
        this.text(value + ' / 100', x + 144, 409, 12, '#514a41', 'right')
        this.round(x + 13, 427, 131, 7, 4, '#ece7dd')
        if (value > 0) this.round(x + 13, 427, 131 * value / 100, 7, 4, color)
      })
      this.text('物资', 26, 473, 15, '#514a41', 'left', true)
      Object.entries(ITEMS).filter(([id]) => id !== 'ball').forEach(([id, item], index) => {
        const x = 25 + (index % 2) * 168
        const y = 488 + Math.floor(index / 2) * 49
        const count = this.care.count(id)
        const actionLabel = id === 'scarf' && this.care.state.scarf ? '摘领巾' : item.action
        if (count) this.button(item.reusable ? actionLabel : `${actionLabel} ×${count}`, x, y, 157, 42, () => this.useItem(id))
        else {
          this.round(x, y, 157, 42, 17, '#ebe6dc')
          this.text(item.reusable ? `${item.name}未解锁` : `${item.name} ×0`, x + 78.5, y + 21, 13, '#72695c', 'center')
        }
      })
      this.button('给小猫带点东西', 25, 611, 325, 54, () => { this.state = 'activities' }, true)
      const canPlace = this.care.count('cushion') && !this.care.state.cushionPlaced
      const hasBall = this.care.count('ball')
      if (canPlace) {
        this.button('把软垫放在窗边', 25, 685, hasBall ? 157 : 325, 46, () => {
          if (!this.care.placeCushion()) return
          this.cushionNap = true
          this.messageUntil = 0
        })
      }
      if (hasBall) this.button('玩具柜', canPlace ? 193 : 25, 685, canPlace ? 157 : 325, 46, () => { this.state = 'toys' })
    }
    choosePetResponse(onCushion, currentPose) {
      const cuddly = this.care.state.favorite === 'pet'
      const sleepy = onCushion || currentPose === 'rest'
      const choices = sleepy ? ['glance', 'settle', 'settle', 'approach'] :
        ['approach', cuddly ? 'approach' : 'glance', 'sniff', 'glance', 'settle']
      const eligible = choices.filter(response => response !== this.lastPetResponse)
      const response = eligible[Math.floor(Math.random() * eligible.length)]
      this.lastPetResponse = response
      return response
    }
    petGreetingPose(now) {
      const start = this.petScene
      const time = now - this.catActionAt
      if (time < 150) return { ...start, note: '耳朵转了过来。' }
      if (start.response === 'glance') return {
        ...start, pose: start.pose === 'window' ? 'glanceBack' : 'glance', note: '转头看了你一眼。'
      }
      if (start.response === 'settle') return {
        ...start, pose: time < 850 ? 'stretch' : 'rest', note: time < 850 ? '原地伸了个懒腰。' : '把爪子收好，又趴下了。'
      }
      const distance = start.x < 183 ? 35 : -30
      const toward = Math.sign(distance)
      const eased = t => t * t * (3 - 2 * t)
      if (start.response === 'sniff') {
        const coming = time < 1050
        const leaving = time > 1900
        const progress = coming ? eased(Math.min(1, (time - 150) / 900)) :
          leaving ? 1 - eased(Math.min(1, (time - 1900) / 950)) : 1
        return {
          ...start, x: start.x + distance * .65 * progress,
          direction: leaving ? -toward : toward, pose: coming || leaving ? 'walk' : 'sniff',
          note: coming ? '好奇地凑过来。' : leaving ? '闻够了，慢慢走开。' : '探着鼻子闻了闻。'
        }
      }
      if (time < 950) return { ...start, pose: 'stretch', direction: toward, note: '伸了个懒腰。' }
      const approach = time < 1850 ? eased((time - 950) / 900) : 1
      const returnTrip = time > 2800
      const progress = returnTrip ? 1 - eased(Math.min(1, (time - 2800) / 1100)) : approach
      const pose = returnTrip || time < 1850 ? 'walk' : 'nuzzle'
      return {
        x: start.x + distance * progress, floor: start.floor + 9 * progress, size: start.size,
        direction: returnTrip ? -toward : toward, pose,
        note: pose === 'nuzzle' ? (start.favorite || '把脸轻轻蹭过来。') : returnTrip ? '慢慢踱了回去。' : '慢慢走过来。'
      }
    }
    drawFoodCorner(crumbs) {
      this.drawRoomShadow(258, 325, 30, 8, '#76554135')
      this.round(236, 304, 45, 17, 7, '#986950')
      this.round(239, 302, 39, 8, 4, '#cda27c')
      if (crumbs) for (const [x, y] of [[237, 324], [245, 328], [261, 330], [275, 325]]) {
        this.round(x, y, 4, 3, 1, '#79523d')
      }
    }
    roomWeather(now) {
      return WEATHER_CYCLE[Math.floor(now / WEATHER_INTERVAL) % WEATHER_CYCLE.length]
    }
    catIdlePose(now, weather = this.roomWeather(now)) {
      const seconds = ((now - this.homeSince) / 1000) % 32
      if (seconds < 8) return { pose: 'window', x: 114, direction: -1, note: weather === 'rain' ? '坐在窗边看雨滴。' : '坐在窗边看树影。' }
      if (seconds < 12) return { pose: 'walk', x: 114 + (seconds - 8) * 27, direction: 1, note: '慢悠悠地走过地毯。' }
      if (seconds < 20 && weather !== 'rain') return { pose: 'groom', x: 222, direction: -1, note: '给自己洗洗脸。' }
      if (seconds < 28) return { pose: 'rest', x: 222, direction: -1, note: '把爪子收起来，趴了一会儿。' }
      return { pose: 'walk', x: 222 - (seconds - 28) * 27, direction: -1, note: '又晃回了窗边。' }
    }
    drawCatFromSide(x, floor, size, pose, direction, now, coat = this.care.state.profile?.coat || 'orange') {
      const c = this.ctx
      const { fur, cream, edge, mark, pattern, eyes = '#816b59' } = COATS[coat] || COATS.orange
      const beat = Math.sin(now / 165)
      const resting = pose === 'rest'
      const walking = pose === 'walk'
      const lookingBack = pose === 'glanceBack'
      const back = pose === 'window' || lookingBack
      const grooming = pose === 'groom'
      const stretching = pose === 'stretch'
      const nuzzling = pose === 'nuzzle'
      const bodyY = resting ? -15 : -28
      c.save(); c.translate(x, floor); c.scale(size * direction, size)
      const ellipse = (cx, cy, rx, ry, color) => {
        c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        c.fillStyle = color; c.fill()
      }
      const line = (color, width) => { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke() }
      c.beginPath(); c.moveTo(-27, -14)
      c.bezierCurveTo(-49, 0, -64, resting || back ? -3 : -17, -65, resting || back ? -5 : -25 + beat * 4)
      line(edge, 10); line(mark, 7)
      if (walking) {
        for (const [leg, phase] of [[-24, 1], [-15, -1], [14, -1], [23, 1]]) {
          const footX = leg + beat * phase * 6
          const footY = -1 - Math.max(0, beat * phase) * 5
          c.beginPath(); c.moveTo(leg, -20); c.quadraticCurveTo(leg, -8, footX, footY)
          line(edge, 8); line(fur, 6)
          ellipse(footX + 2, footY, 4.7, 3, cream)
        }
      }
      if (stretching) {
        for (const offset of [0, 6]) {
          c.beginPath(); c.moveTo(11, -22 + offset / 2); c.quadraticCurveTo(24, -2, 43 + offset, -2)
          line(edge, 8); line(fur, 6)
          ellipse(43 + offset, -2, 5, 3.4, cream)
        }
      }
      ellipse(-5, bodyY, back ? 22 : 34, resting ? 14 : back ? 25 : 17, edge)
      ellipse(-5, bodyY - 1, back ? 20.5 : 32.5, resting ? 13 : back ? 23.5 : 15.5, fur)
      if (!back) {
        ellipse(10, bodyY + 6, 16, resting ? 5 : 7, cream)
        if (!walking) ellipse(24, -3, 10, 4, cream)
      }
      if (coat === 'calico' || coat === 'tuxedo' || pattern === 'patch') {
        ellipse(-21, bodyY - 3, 13, 10, mark)
        ellipse(3, bodyY - 7, 8, 7, coat === 'calico' ? '#766060' : mark)
      }
      if (pattern === 'striped' || coat === 'orange') {
        for (const stripe of [-24, -14, -4]) {
          c.beginPath(); c.moveTo(stripe, bodyY - 13); c.quadraticCurveTo(stripe + 4, bodyY - 9, stripe + 2, bodyY - 5)
          line(mark, 2.7)
        }
      }
      const headX = back ? 9 : resting ? 28 : 29
      const headY = back ? -57 : resting ? -14 : stretching ? -20 : nuzzling ? -31 + beat * 2 :
        pose === 'sniff' ? -20 + beat : grooming ? -35 : -41 + beat
      c.save(); c.translate(headX, headY)
      if (nuzzling) c.rotate(.11 + beat * .06)
      const ear = (left, top) => {
        c.beginPath(); c.moveTo(left, -5); c.quadraticCurveTo(left + 1, top, left + 4, top)
        c.quadraticCurveTo(left + 9, top + 1, left + 14, -8); c.closePath()
        c.fillStyle = pattern === 'point' ? mark : fur; c.fill(); line(edge, 1.4)
      }
      ear(-17, -27); ear(back ? 5 : -3, back ? -26 : -23)
      ellipse(0, 0, 21, back ? 18 : 16, edge)
      ellipse(0, -1, 19.5, back ? 17 : 15, fur)
      if (!back || lookingBack) {
        ellipse(11, 5, 12, 8, cream)
        ellipse(21, 2, 3, 2.5, '#965f53')
        if (resting || grooming || nuzzling || stretching) {
          c.beginPath(); c.moveTo(6, -4); c.quadraticCurveTo(10, -1, 14, -4); line(edge, 1.4)
        } else {
          ellipse(10, -5, 3.5, 4, eyes); ellipse(11, -5, 1.5, 3, '#44372d')
        }
        c.beginPath(); c.moveTo(15, 8); c.lineTo(27, 8); c.moveTo(15, 10); c.lineTo(25, 13); line(edge, .9)
      }
      c.restore()
      if (grooming) {
        const pawY = -17 - (beat + 1) * 6
        c.beginPath(); c.moveTo(15, -7); c.quadraticCurveTo(28, -7, 35, pawY)
        line(edge, 9); line(fur, 6)
        ellipse(35, pawY, 5, 4, cream)
      }
      c.restore()
    }
    drawRoom(weather = 'sunny', now = 0, windowVisit = -1) {
      const c = this.ctx
      const atmosphere = WEATHER[weather] || WEATHER.sunny
      c.save()
      this.round(24, 102, 327, 270, 24, '#f5e7d7')
      c.clip()
      const wall = c.createLinearGradient(52, 123, 351, 290)
      wall.addColorStop(0, '#fff2dd')
      wall.addColorStop(.55, '#f2dcc4')
      wall.addColorStop(1, '#d7b39e')
      c.fillStyle = wall; c.fillRect(24, 102, 327, 179)
      const boards = ['#d7a382', '#e3b28e', '#d6a384', '#e2b492', '#dbab87', '#d2a07e']
      boards.forEach((color, row) => {
        const y = 275 + row * 17
        c.fillStyle = color; c.fillRect(24, y, 327, 17)
        c.fillStyle = '#b887697d'; c.fillRect(24, y, 327, .8)
        c.fillStyle = '#f0c6a5'; c.fillRect(24, y + 1, 327, .7)
        const seam = 58 + row % 3 * 29
        for (let x = seam; x < 350; x += 113) c.fillRect(x, y + 1, .75, 16)
        c.strokeStyle = '#9d6d5c32'; c.lineWidth = .6
        for (let grain = 0; grain < 9; grain++) {
          const x = 28 + grain * 36 + (row * 13 + grain * 7) % 17
          const gy = y + 5 + (row + grain * 3) % 9
          c.beginPath(); c.moveTo(x, gy); c.quadraticCurveTo(x + 9, gy - 1.3, x + 22, gy); c.stroke()
        }
      })
      c.fillStyle = '#b3877277'; c.fillRect(24, 274, 327, 4)
      c.fillStyle = '#eed2b7'; c.fillRect(24, 265, 327, 9)
      c.fillStyle = '#fff0d8'; c.fillRect(24, 266, 327, 1.5)
      c.fillStyle = atmosphere.light
      c.beginPath(); c.moveTo(55, 227); c.lineTo(132, 227); c.lineTo(269, 359); c.lineTo(104, 359); c.closePath(); c.fill()

      c.save()
      this.round(46, 124, 95, 112, 43, '#ab7d6260')
      this.round(44, 120, 94, 112, 43, '#fff8eb', '#ebd4b9')
      this.round(51, 127, 80, 97, 35, atmosphere.sky)
      c.clip()
      const ellipse = (x, y, rx, ry, color) => {
        c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI); c.fillStyle = color; c.fill()
      }
      if (weather === 'sunny') ellipse(79, 158, 13, 13, '#fff0b7')
      else ellipse(77, 160, 22, 6, '#dee4e0')
      ellipse(107, 154, 17, 4, '#edf2df')
      ellipse(120, 158, 14, 3, '#edf2df')
      ellipse(62, 219, 41, 32, '#a7bfa3')
      ellipse(119, 218, 43, 39, '#88aa96')
      ellipse(92, 228, 64, 28, '#719583')
      for (let i = 0; i < 9; i++) {
        const x = 51 + i * 10
        const y = 218 - (i * 7 % 12)
        ellipse(x, y, 4, 7, i % 2 ? '#83a28a' : '#658873')
      }
      if (weather === 'rain') {
        c.strokeStyle = '#e3f2f2a8'; c.lineWidth = .85
        for (let i = 0; i < 17; i++) {
          const y = 131 + (now / 16 + i * 23) % 93
          const x = 54 + i * 13 % 74
          c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3, y + 9); c.stroke()
        }
        if (windowVisit >= 0) {
          const y = 153 + Math.min(56, windowVisit / 40)
          ellipse(108, y, 1.6, 3.3, '#eaf6f3')
        }
      } else if (windowVisit >= 0) {
        const x = 128 - Math.min(69, windowVisit / 18)
        const y = 165 + Math.sin(windowVisit / 220) * 4
        ellipse(x, y, 6, 3, '#65766a')
        c.strokeStyle = '#65766a'; c.lineWidth = 1.6; c.lineCap = 'round'
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 2, y - 6 + Math.sin(windowVisit / 50) * 4, x + 7, y - 3); c.stroke()
      }
      c.restore()
      this.round(89, 128, 5, 96, 2, '#fff8eb')
      this.round(53, 175, 77, 5, 2, '#fff8eb')
      this.round(39, 221, 104, 9, 4, '#fff8eb')
      this.round(40, 227, 102, 3, 1.5, '#dfbba0')
      for (const [left, direction] of [[43, 1], [140, -1]]) {
        c.save(); c.translate(left, 135); c.scale(direction, 1)
        c.beginPath(); c.moveTo(0, 0); c.lineTo(20, 0); c.quadraticCurveTo(16, 31, 5, 51)
        c.quadraticCurveTo(9, 67, 13, 77); c.quadraticCurveTo(8, 81, 0, 77); c.closePath()
        c.fillStyle = '#9bac8f'; c.fill()
        c.strokeStyle = '#7d937c'; c.lineWidth = 1
        for (const fold of [4, 9, 14]) {
          c.beginPath(); c.moveTo(fold, 2); c.quadraticCurveTo(fold - 1, 28, 3 + fold / 5, 48); c.stroke()
        }
        this.round(0, 47, 9, 4, 2, '#e8bf8d')
        c.restore()
      }
      this.round(38, 132, 107, 4, 2, '#b28e73')

      this.round(263, 200, 62, 6, 3, '#a87d62')
      this.round(271, 178, 9, 22, 2, '#9da88b')
      this.round(282, 175, 10, 25, 2, '#bd8476')
      this.round(293, 181, 7, 19, 2, '#e3b27b')
      c.strokeStyle = '#76856d'; c.lineWidth = 1.8
      c.beginPath(); c.moveTo(313, 194); c.quadraticCurveTo(307, 176, 317, 164); c.stroke()
      this.round(304, 187, 17, 13, 5, '#f4e2cc')
      c.fillStyle = '#899a79'
      c.beginPath(); c.ellipse(312, 174, 4, 8, -.65, 0, 2 * Math.PI); c.fill()
      c.beginPath(); c.ellipse(320, 169, 4, 8, .65, 0, 2 * Math.PI); c.fill()
      this.round(267, 205, 4, 9, 2, '#ad886f')
      this.round(316, 205, 4, 9, 2, '#ad886f')
      c.strokeStyle = '#7b9071'; c.lineWidth = 1.4
      c.beginPath(); c.moveTo(320, 190); c.quadraticCurveTo(335, 202, 327, 228); c.stroke()
      ellipse(329, 211, 5, 3, '#8da17d')
      ellipse(325, 221, 4, 3, '#9aab87')

      this.drawRoomShadow(184, 318, 117, 25, '#72534736')
      this.round(73, 277, 225, 62, 30, '#bc8b77')
      this.round(79, 280, 213, 55, 27, '#ead3bb', '#e0b79e')
      c.save()
      this.round(85, 285, 201, 45, 22, '#f0dcc3')
      c.clip()
      c.strokeStyle = '#c299805c'; c.lineWidth = .65
      for (let y = 287; y < 331; y += 2.4) {
        c.beginPath(); c.moveTo(85, y); c.lineTo(286, y); c.stroke()
      }
      c.strokeStyle = '#fff1db7f'
      for (let x = 86; x < 286; x += 3.7) {
        c.beginPath(); c.moveTo(x, 286); c.lineTo(x, 331); c.stroke()
      }
      c.restore()
      this.round(93, 289, 185, 37, 18, null, '#e3c3a5')
      c.restore()
      this.round(24, 102, 327, 270, 24, null, '#e6cbb6')
    }
    drawRoomShadow(x, y, width, height, color) {
      const c = this.ctx
      c.beginPath(); c.ellipse(x, y, width, height, 0, 0, 2 * Math.PI)
      c.fillStyle = color; c.fill()
    }
    drawRugFold(height) {
      const c = this.ctx
      const lift = 17 * height
      this.drawRoomShadow(109, 330, 27, 4 * height, '#72534765')
      c.beginPath(); c.moveTo(80, 319)
      c.quadraticCurveTo(94, 332 - lift, 107, 331 - lift)
      c.quadraticCurveTo(115, 329 - lift, 127, 307)
      c.quadraticCurveTo(124, 329, 115, 335)
      c.quadraticCurveTo(97, 335, 80, 319)
      c.closePath(); c.fillStyle = '#bf8f77'; c.fill()
      c.beginPath(); c.moveTo(88, 322)
      c.quadraticCurveTo(110, 329 - lift, 124, 310)
      c.strokeStyle = '#f2dbc0'; c.lineWidth = 2; c.stroke()
    }
    drawRoomBox(x, y) {
      this.drawRoomShadow(x + 33, y + 53, 39, 7, '#76554145')
      this.round(x + 8, y + 5, 61, 47, 5, '#ad784f')
      this.round(x, y + 11, 61, 42, 5, '#c89564')
      this.round(x - 4, y + 2, 72, 12, 4, '#e0b386')
      this.round(x + 22, y + 3, 17, 31, 3, '#efd0a5')
      this.round(x + 43, y + 36, 11, 7, 2, '#f7e2bd')
      this.round(x + 4, y + 48, 53, 1, .5, '#b37d55')
    }
    drawYarnBall(x, y, turn, color = 'rose') {
      const c = this.ctx
      const { edge, yarn, thread } = BALL_COLORS[color] || BALL_COLORS.rose
      this.drawRoomShadow(x, y + 9, 13, 3.5, '#76554145')
      c.save(); c.translate(x, y); c.rotate(turn)
      this.drawRoomShadow(0, 0, 10.5, 10.5, edge)
      this.drawRoomShadow(0, -1, 9.6, 9, yarn)
      c.strokeStyle = thread; c.lineWidth = 1.1
      for (const offset of [-5, -1, 3]) {
        c.beginPath(); c.moveTo(-7, offset - 3); c.quadraticCurveTo(-1, offset + 5, 8, offset); c.stroke()
      }
      c.restore()
    }
    drawCushion(x, y, width) {
      this.round(x, y + 4, width, 32, 16, '#a16c5a')
      this.round(x, y, width, 31, 15, '#d89e85')
      this.round(x + 8, y + 4, width - 16, 7, 4, '#edbca4')
    }
    drawAlbum() {
      this.text(GAME_NAME, 26, 38, 10, '#969d82', 'left', true)
      this.text('猫窝相册', 26, 70, 32, '#454d38', 'left', true)
      this.button('回猫窝', 261, 50, 90, 38, () => this.goHome(false))
      const { boxPhoto, cushionPhoto } = this.care.state
      const showingCushion = this.albumPage === 1
      const photo = showingCushion ? cushionPhoto : boxPhoto
      this.button('纸箱小窝', 27, 508, 155, 41, () => { this.albumPage = 0 }, !showingCushion)
      this.button('窗边软垫', 193, 508, 155, 41, () => { this.albumPage = 1 }, showingCushion)
      this.round(27, 127, 321, 360, 21, '#fffdf8')
      this.round(45, 145, 285, 265, 12, '#e9dfcd')
      if (!photo) {
        this.text('还没有照片', W / 2, 245, 23, '#655548', 'center', true)
        this.text(showingCushion ? '等它在窗边软垫上小憩。' : '等它在纸箱里睡着，就能拍一张。', W / 2, 283, 14, '#655548', 'center')
        return
      }
      const c = this.ctx
      c.save(); c.translate(45, 160); c.scale(.87, .87); c.translate(-24, -102)
      this.drawRoom(photo.weather || 'sunny', photo.time)
      if (showingCushion) {
        this.drawCushion(47, 276, 135)
        this.drawCatFromSide(115, 296, 1.05, 'rest', -1, photo.time, photo.coat)
      } else this.cat(228, 235, 1.45, 'boxNap', photo.coat)
      c.restore()
      const date = new Date(photo.time)
      this.text(photo.name + (showingCushion ? '在窗边睡着了' : '把纸箱当成了窝'), W / 2, 439, 18, '#655548', 'center', true)
      this.text(`${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`, W / 2, 466, 12, '#746757', 'center')
    }
    drawActivities() {
      this.text(GAME_NAME, 26, 38, 10, '#969d82', 'left', true)
      this.text('带点东西回家', 26, 70, 29, '#454d38', 'left', true)
      this.button('回猫窝', 261, 50, 90, 38, () => this.goHome(false))
      const cards = [
        { title: '零食柜', note: `清空 ${this.levelGoal} 行或列`, reward: ITEMS[this.levelReward].name, color: '#e8ead9', open: () => this.start('classic') },
        { title: '纸袋找玩具', note: '盯住藏着玩具的纸袋', reward: this.bagRewardLabel, color: '#f0e1ce', open: () => this.startBags() }
      ]
      cards.forEach(({ title, note, reward, color, open }, index) => {
        const y = 137 + index * 183
        this.round(25, y, 325, 159, 23, color)
        this.text(title, 44, y + 33, 23, '#454d38', 'left', true)
        this.text(note, 44, y + 65, 13, '#635848')
        this.text(`可以带回 · ${reward}`, 44, y + 110, 13, '#635848')
        this.button('开始', 237, y + 91, 91, 43, open, true)
      })
      this.button('每日同题', 25, 519, 325, 48, () => this.start('daily'))
    }
    drawToyCabinet() {
      this.text(GAME_NAME, 26, 38, 10, '#969d82', 'left', true)
      this.text('玩具柜', 26, 70, 33, '#454d38', 'left', true)
      this.button('回猫窝', 261, 50, 90, 38, () => this.goHome(false))
      this.round(25, 126, 325, 360, 23, '#ede0ce')
      this.text('毛线球', 45, 162, 23, '#5b513f', 'left', true)
      const selected = this.care.state.ballColor || 'rose'
      Object.entries(BALL_COLORS).forEach(([color, palette], index) => {
        const x = 45 + index * 147
        const unlocked = color === 'rose' || this.care.count('sageYarn')
        this.round(x, 194, 137, 151, 17, '#fff9ed', color === selected ? '#839271' : null)
        const c = this.ctx
        c.save(); c.translate(x + 68.5, 243); c.scale(2.5, 2.5)
        this.drawYarnBall(0, 0, .25, color)
        c.restore()
        this.text(palette.label, x + 68.5, 291, 15, '#5b513f', 'center', true)
        if (unlocked && color !== selected) this.button('换上', x + 22, 303, 93, 32, () => this.care.chooseBallColor(color))
        else this.text(unlocked ? '使用中' : '去纸袋找玩具解锁', x + 68.5, 319, 12, '#69775f', 'center')
      })
      this.button('回去滚毛线球', 45, 389, 285, 49, () => {
        this.goHome(false)
        if (this.boxIntroAt === undefined) this.useItem('ball')
      }, true)
    }
    get bagReward() {
      if (!this.care.count('cushion')) return 'cushion'
      if (!this.care.count('ball')) return 'ball'
      if (!this.care.count('sageYarn')) return 'sageYarn'
      return this.care.completed('bags') % 2 ? 'food' : 'water'
    }
    get bagRewardLabel() {
      const reward = this.bagReward
      return reward === 'cushion' ? '窗边软垫' : reward === 'sageYarn' ? '鼠尾草绿毛线' : ITEMS[reward].name
    }
    startBags() {
      this.bagRound = 0
      this.state = 'bags'
      this.prepareBags()
    }
    prepareBags() {
      this.bagStart = Math.floor(Math.random() * 3)
      this.bagPositions = [this.bagStart]
      this.bagSwaps = []
      for (let i = 0; i < BAG_ROUNDS[this.bagRound]; i++) {
        const last = this.bagPositions[i]
        const options = BAG_PAIRS.filter(pair => i ? pair !== this.bagSwaps[i - 1] : pair.includes(last))
        const pair = options[Math.floor(Math.random() * options.length)]
        this.bagSwaps.push(pair)
        const [left, right] = pair
        this.bagPositions.push(last === left ? right : last === right ? left : last)
      }
      this.bagTarget = this.bagPositions[this.bagPositions.length - 1]
      this.bagPhase = 'look'
      this.bagMiss = -1
    }
    bagLayout(now) {
      const slots = [0, 1, 2].map(index => ({ x: 47 + index * 99, y: 258, index }))
      if (this.bagPhase !== 'shuffle') return slots
      const duration = BAG_SWAP_MS[this.bagRound]
      const elapsed = Math.max(0, now - this.bagShuffleAt)
      const step = Math.floor(elapsed / duration)
      if (step >= this.bagSwaps.length) {
        this.bagPhase = 'pick'
        return slots
      }
      const [left, right] = this.bagSwaps[step]
      const progress = Math.min(1, (elapsed % duration) / (duration - 110))
      const slide = progress * progress * (3 - 2 * progress)
      const arc = Math.sin(progress * Math.PI) * 46
      const distance = (right - left) * 99 * slide
      slots[left].x += distance
      slots[left].y -= arc
      slots[right].x -= distance
      slots[right].y += arc
      return slots.sort((a, b) => a.y - b.y)
    }
    pickBag(index) {
      if (this.bagPhase !== 'pick') return
      if (index !== this.bagTarget) {
        this.bagMiss = index
        this.bagPhase = 'miss'
        return
      }
      if (++this.bagRound < BAG_ROUNDS.length) {
        this.bagPhase = 'found'
        return
      }
      this.bagPrize = this.bagRewardLabel
      this.care.grant('bags', this.care.completed('bags') + 1, this.bagReward)
      this.bagPhase = 'won'
    }
    drawBags() {
      this.text(GAME_NAME, 26, 38, 10, '#969d82', 'left', true)
      this.text('纸袋找玩具', 26, 70, 32, '#454d38', 'left', true)
      this.button('小游戏', 263, 50, 88, 38, () => { this.state = 'activities' })
      this.round(25, 125, 325, 411, 24, '#ede3d4')
      if (this.bagPhase === 'won') {
        this.cat(W / 2, 237, 1.2, 'pet')
        this.text('三样玩具都找到了', W / 2, 349, 23, '#5b513f', 'center', true)
        this.text(`已带回猫窝 · ${this.bagPrize}`, W / 2, 390, 16, '#5b513f', 'center')
        this.button('回猫窝', 47, 450, 281, 50, () => this.goHome(), true)
        return
      }
      const slots = this.bagLayout(Date.now())
      const looking = this.bagPhase === 'look'
      const found = this.bagPhase === 'found'
      const prompt = {
        look: '看清玩具在哪只袋里',
        shuffle: '跟住那只纸袋',
        pick: '玩具现在在哪只袋里？',
        miss: '这只纸袋是空的',
        found: '找到啦！'
      }
      this.text(`找到 ${this.bagRound} / ${BAG_ROUNDS.length}`, W / 2, 158, 15, '#5b513f', 'center', true)
      this.text(prompt[this.bagPhase], W / 2, 194, 19, '#5b513f', 'center', true)
      slots.forEach(({ x, y, index }) => {
        const visible = (looking && index === this.bagStart) || (found && index === this.bagTarget)
        const empty = this.bagPhase === 'miss' && this.bagMiss === index
        this.drawRoomShadow(x + 41, y + 104, 40, 8, '#78563e32')
        this.round(x, y, 83, 104, 13, visible ? '#c6caa2' : '#d8ab7d')
        this.round(x + 4, y + 3, 75, 15, 7, visible || empty ? '#ae815b' : '#eed1aa')
        this.round(x + 12, y + 28, 59, 52, 9, '#f2d7ac')
        if (visible) this.drawYarnBall(x + 41.5, y + 54, .35)
        if (empty) this.text('空', x + 41.5, y + 54, 17, '#74543e', 'center', true)
        if (this.bagPhase === 'pick') this.buttons.push({ x, y, w: 83, h: 104, action: () => this.pickBag(index) })
      })
      if (looking) this.button('开始换位', 47, 441, 281, 49, () => {
        this.bagShuffleAt = Date.now()
        this.bagPhase = 'shuffle'
        this.bagMiss = -1
      }, true)
      else if (found) this.button('找下一个玩具', 47, 441, 281, 49, () => this.prepareBags(), true)
      else if (this.bagPhase === 'miss' || this.bagPhase === 'pick') {
        this.button('重看这轮', 47, 441, 281, 49, () => { this.bagPhase = 'look' })
      }
    }
    drawCompliance() {
      this.text(GAME_NAME, W / 2, 66, 36, '#454d38', 'center', true)
      this.text('轻度收纳 · 养猫', W / 2, 105, 14, '#8d927d', 'center')
      this.cat(W / 2, 156, 1.1)
      this.round(25, 226, 325, 52, 14, '#dfe9d7')
      this.text('健康游戏忠告', 41, 252, 15, '#415a37', 'left', true)
      this.text('CADPA · 适龄提示', 334, 252, 11, '#5c7a51', 'right')
      HEALTH_NOTICE.forEach((line, index) => this.text(line, W / 2, 301 + index * 30, 13, '#514a41', 'center'))
      this.round(25, 434, 325, 106, 16, '#fffdf8')
      this.round(41, 450, 58, 58, 12, '#3f8f4f')
      this.text(AGE_RATING, 70, 471, 19, '#ffffff', 'center', true)
      this.text('适龄提示', 70, 493, 10, '#ffffff', 'center')
      this.text('点标记查看适龄说明', 112, 467, 12, '#657356', 'left')
      this.text('单机游戏 · 无内购 · 无联网对战', 112, 490, 11, '#9a9589', 'left')
      this.buttons.push({ x: 41, y: 450, w: 58, h: 58, action: () => { this.ageNoteOpen = true } })
      this.button('开始游戏', 25, 562, 325, 55, () => { this.compliance = false }, true)
      this.button('隐私保护指引', 25, 629, 325, 46, () => this.platform.openPrivacy())
      this.text('适龄提示由后台设置，审核通过后以启动页展示为准', W / 2, 704, 10, '#a09b8d', 'center')
      if (this.ageNoteOpen) {
        this.buttons = []
        this.round(25, 430, 325, 250, 20, '#fffdf8')
        this.text('适龄提示 · ' + AGE_RATING, 43, 460, 17, '#3f8f4f', 'left', true)
        const lines = AGE_NOTE.match(/.{1,16}/g) || []
        lines.forEach((line, index) => this.text(line, 43, 497 + index * 25, 13, '#514a41'))
        this.button('知道了', 43, 628, 289, 40, () => { this.ageNoteOpen = false }, true)
      }
    }
    render() {
      const c = this.ctx
      c.setTransform(this.ratio, 0, 0, this.ratio, 0, 0)
      c.fillStyle = '#f6f2e9'; c.fillRect(0, 0, this.width, this.height)
      c.translate(this.offsetX, this.offsetY); c.scale(this.scale, this.scale)
      this.buttons = []
      if (this.compliance) {
        this.drawCompliance()
        return
      }
      if (this.state === 'profile') {
        this.drawProfile()
        return
      }
      if (this.state === 'home') {
        this.drawCatHome()
        return
      }
      if (this.state === 'album') {
        this.drawAlbum()
        return
      }
      if (this.state === 'toys') {
        this.drawToyCabinet()
        return
      }
      if (this.state === 'activities' || this.state === 'bags') {
        if (this.state === 'activities') this.drawActivities()
        else this.drawBags()
        return
      }
      this.text(GAME_NAME, 27, 55, 10, '#969d82', 'left', true)
      this.text('零食柜', 25, 86, 30, '#454d38', 'left', true)
      this.text(this.mode === 'classic' ? `通关奖励 · ${ITEMS[this.levelReward].name}` : '今日目标 · 800 分', 27, 116, 13, '#657356')
      this.cat(309, 97, .58)
      this.round(25, 144, 325, 56, 18, '#e9e8da')
      this.text('本局得分', 44, 162, 10, '#8d927d'); this.text(this.game.score, 44, 184, 22, '#536448', 'left', true)
      if (this.mode === 'classic' && this.state === 'playing') {
        const progress = this.game.lines / this.levelGoal
        this.text(`第 ${this.unlockedLevel} 关 · 清空行列`, 141, 160, 11, '#657356')
        this.text(`${this.game.lines} / ${this.levelGoal}`, 141, 178, 14, '#536448', 'left', true)
        this.round(141, 189, 129, 5, 3, '#d6d8c8')
        if (progress > 0) this.round(141, 189, 129 * progress, 5, 3, '#789367')
      } else {
        this.text(this.mode === 'daily' ? '今日个人最佳' : '个人最佳', 179, 162, 10, '#8d927d')
        this.text(this.best || 0, 179, 184, 22, '#536448', 'left', true)
      }
      if (this.state === 'playing') {
        this.button('Ⅱ', 292, 150, 45, 43, () => { this.cancel(); this.state = 'paused' })
      }
      this.drawBoard()
      this.text('待收纳的零食', 27, 541, 11, '#9a9589')
      this.drawTray()
      this.button('旋转 ↻', 25, 687, 155, 46, () => {
        if (this.state !== 'playing') return
        this.game.rotate(this.selected); this.notify('换个方向，试试这个空位')
      })
      this.button('撤回一步', 195, 687, 155, 46, () => { if (this.state === 'playing') this.undo() })
      this.text(this.mode === 'daily' ? '每日同题 · 本地日期更新 · 自由旋转' : '填满整行或整列即可清空 · 方块可旋转', W / 2, 758, 11, '#9a9589', 'center')
      if (this.messageUntil > Date.now() && this.state === 'playing') {
        this.round(25, 742, 325, 32, 12, '#514e44')
        this.text(this.message, W / 2, 758, 12, '#fffdf8', 'center')
      }
      if (this.state === 'playing') this.drawDraggedPiece()
      else this.overlay()
    }
    overlay() {
      const c = this.ctx
      c.fillStyle = '#f6f2e9'; c.fillRect(0, 0, W, H)
      this.buttons = []
      this.cat(W / 2, 195, 1.35)
      if (this.state === 'paused') {
        this.text('歇一小会儿', W / 2, 310, 29, '#454d38', 'center', true)
        this.text('零食还在原处，随时回来', W / 2, 352, 14, '#96917f', 'center')
        this.button('继续收纳', 48, 421, 279, 55, () => { this.state = 'playing' }, true)
        this.button('重新开始这一局', 48, 494, 279, 51, () => this.start(this.mode))
        this.button('回猫窝', 48, 567, 279, 51, () => this.goHome())
      } else if (this.state === 'cleared') {
        this.text(`第 ${this.clearedLevel} 关通关！`, W / 2, 300, 30, '#454d38', 'center', true)
        this.round(74, 340, 227, 90, 20, '#ede4d2')
        this.text('给小猫带回家', W / 2, 361, 12, '#796652', 'center')
        this.text(ITEMS[this.earnedItem].name, W / 2, 395, 29, '#6a573e', 'center', true)
        this.text(`本关得分 ${this.game.score}`, W / 2, 463, 13, '#797164', 'center')
        this.button('回猫窝', 48, 514, 279, 55, () => this.goHome(), true)
        this.button(`进入第 ${this.unlockedLevel} 关`, 48, 581, 279, 51, () => this.start('classic'))
      } else {
        this.text('柜子装满啦', W / 2, 306, 29, '#454d38', 'center', true)
        this.text('这次收纳得分', W / 2, 350, 14, '#96917f', 'center')
        this.text(this.game.score, W / 2, 401, 53, '#657f5a', 'center', true)
        const summary = this.mode === 'classic'
          ? `第 ${this.unlockedLevel} 关 · 清空 ${this.game.lines} / ${this.levelGoal} 条`
          : `清空 ${this.game.lines} 条 · 放好 ${this.game.moves} 块`
        this.text(summary, W / 2, 450, 14, '#96917f', 'center')
        this.button(this.mode === 'classic' ? '重试本关' : '再收一柜', 48, 501, 279, 55, () => this.start(this.mode), true)
        if (this.game.last) this.button('撤回最后一步再试试', 48, 573, 279, 51, () => this.undo())
        this.button('回猫窝', 48, 644, 279, 49, () => this.goHome())
      }
    }
    updateCatHome(now) {
      if (this.petScene && (this.catAction !== 'pet' || now >= this.messageUntil)) {
        if (this.catAction === 'pet') this.homeSince += this.petScene.duration
        this.petScene = null
      }
      if (this.boxIntroAt === undefined || now - this.boxIntroAt < BOX_INTRO_MS) return
      this.care.finishBoxIntroduction()
      this.boxIntroAt = undefined
      this.boxNap = true
      this.cushionNap = false
    }
    goHome(newVisit = true) {
      this.state = 'home'
      this.catAction = ''
      this.petScene = null
      this.messageUntil = 0
      this.homeSince = Date.now()
      if (!newVisit) return
      const { cushionPlaced, cushionPhoto, boxPhoto, favorite } = this.care.state
      this.cushionNap = cushionPlaced && (!this.care.count('box') || boxPhoto) && (!cushionPhoto || Math.random() < .5)
      if (!this.care.count('box')) return
      if (!this.care.state.metBox) {
        if (this.boxIntroAt === undefined) this.boxIntroAt = Date.now()
      } else {
        this.boxNap = !boxPhoto || favorite === 'box' || Math.random() < .5
      }
    }
  }
  return { PantryView }
})
