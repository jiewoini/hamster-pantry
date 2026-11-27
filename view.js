(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./cat-care'), require('./find-game'))
  else root.PantryView = factory(root.CatCare, root.FindGame)
})(typeof globalThis !== 'undefined' ? globalThis : this, function ({ CatCare, ITEMS, COATS, FAVORITES, BALL_COLORS }, FindGameModule) {
  const { FindGame, CATEGORIES: FIND_CATEGORIES, LEVELS: FIND_LEVELS } = FindGameModule
  const COLORS = ['#e9e2d7', '#e8a457', '#86aa8b', '#9c9bc7', '#dc8d80']
  const W = 375, H = 800, CELL = 43, BX = 37, BY = 222
  const DRAG_GAP = 36
  const LEVEL_KEY = 'pantry_unlocked_level_v1'
  const INTRO_LEVEL = { goal: 2, pools: [2, 4, 9] }
  const EARLY_LEVELS = [
    { goal: 4, pools: [3, 6, 9] },
    { goal: 5, pools: [3, 7, 9] },
    { goal: 6, pools: [4, 7, 9] },
    { goal: 7, pools: [4, 8, 9] }
  ]
  const LATER_LEVELS = [
    { goal: 6, pools: [3, 7, 9] },
    { goal: 7, pools: [4, 7, 9] },
    { goal: 6, pools: [3, 6, 9] },
    { goal: 7, pools: [4, 8, 9] },
    { goal: 8, pools: [4, 8, 9] }
  ]
  const PANTRY_REWARDS = ['food', 'water', 'box', 'scarf']
  const COAT_ENTRIES = Object.entries(COATS)
  const COATS_PER_PAGE = 4
  const BOX_INTRO_MS = 3800
  const TIME_RESCUE_MS = 45000
  const PET_GREETING_MS = { approach: 3900, sniff: 2850, glance: 1650, settle: 2200 }
  const TEASER_PASS_SCORE = 80
  const TEASER_SETTLE_MS = 180
  const TEASER_STILL_RADIUS = 11
  const TEASER_REWARD_SOURCE = 'bags'
  const TEASER_AREA = { x: 61, y: 250, w: 253, h: 66 }
  const FIND_REWARD_SOURCE = 'find'
  const FIND_HINT_MS = 1800
  const FIND_HELP_KEY = 'pantry_find_help_v1'
  const FIND_MIN_ZOOM = 1
  const FIND_MAX_ZOOM = 2.2
  // 昵称只允许从预设白名单里选，不提供任何自由文本输入，从源头避免 UGC 内容安全风险
  const CAT_NAME_POOL = [
    '团子', '汤圆', '年糕', '布丁', '奶糖', '豆包', '麻薯', '芝麻', '花卷', '糯米',
    '可乐', '雪球', '橘子', '柚子', '栗子', '土豆', '饭团', '小满', '元宝', '珍珠',
    '棉花', '豆腐', '包子', '麦芽', '果冻', '泡芙', '杏仁', '桃子', '柠檬', '山楂',
    '海苔', '瓜子', '奶酪', '苏打', '薄荷', '红豆', '绿豆', '米粒', '蛋黄', '小贝'
  ]
  const NAME_PICK_COUNT = 20
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
  const AGE_ICON = 'age-8plus.png'
  const AGE_NOTE = '本游戏是一款轻度收纳与养猫休闲游戏，适用于年满 8 周岁及以上用户，建议未成年人在家长监护下使用。游戏玩法为拖拽方块收纳消除、照顾猫咪与纸袋找玩具，没有基于文字、语音、图片的陌生人社交系统，也没有内购与付费内容。游戏进度仅保存在本机，不含联网对战。未成年人游戏时长以微信平台健康系统的管理为准。适度游玩有助于放松心情、锻炼观察与规划能力。'
  const PRIVACY_NOTE = '本游戏在本机保存猫咪档案、关卡进度和个人最佳成绩。自定义小猫昵称在保存前会通过微信内容安全接口进行合规校验，校验结果仅用于拦截违规昵称，昵称本身不存储到自有服务器、不公开展示。不收集姓名、手机号、位置、通讯录、头像或微信好友关系，不含内购与付费。清除微信缓存会删除本机进度。'
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
      this.privacyOpen = false
      this.ageIcon = null
      this.loadAgeIcon()
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
        const now = Date.now()
        if (this.state === 'home') this.updateCatHome(now)
        if (this.state === 'playing') this.updateClock(now)
        if (this.state === 'teaser') this.updateTeaser(now)
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
      if (this.state === 'playing') this.pauseBoard()
    }
    key() { return this.mode === 'daily' ? `pantry_daily_${this.day}` : 'pantry_classic_v1' }
    get unlockedLevel() { return Math.max(this.legacyLevel, this.care.completed('pantry') + 1) }
    get levelRules() {
      const index = this.unlockedLevel - 2
      if (index < 0) return INTRO_LEVEL
      return EARLY_LEVELS[index] || LATER_LEVELS[(index - EARLY_LEVELS.length) % LATER_LEVELS.length]
    }
    get levelGoal() { return this.levelRules.goal }
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
      const gravityReady = mode === 'classic' && this.unlockedLevel >= 4
      this.game = new this.engine.Game(seed, mode === 'classic' ? this.levelRules.pools : null, {
        fixedOrientation: true, gravityReady, rescueReady: mode === 'classic'
      })
      this.state = 'playing'; this.selected = 0; this.pointer = null; this.effects = []
      this.comboPop = null
      this.overReason = null
      this.remainingMs = mode === 'classic' ? (90 + 25 * this.levelGoal) * 1000 : null
      this.resumeBoard()
      this.best = Number(this.platform.read(this.key())) || 0
      this.notify(mode === 'daily' ? '今天同一套方块，试着突破 800 分' : `清空 ${this.levelGoal} 行或列，带${ITEMS[this.levelReward].name}回家`)
    }
    notify(message) { this.message = message; this.messageUntil = Date.now() + 2300 }
    resumeBoard() {
      this.state = 'playing'
      this.deadline = this.remainingMs === null ? null : Date.now() + this.remainingMs
    }
    updateClock(now) {
      if (this.state !== 'playing' || this.deadline === null) return
      this.remainingMs = Math.max(0, this.deadline - now)
      if (this.remainingMs) return
      this.cancel()
      this.overReason = 'time'
      this.state = 'over'
    }
    pauseBoard() {
      this.updateClock(Date.now())
      if (this.state === 'playing') this.state = 'paused'
      this.cancel()
    }
    clockLabel() {
      const seconds = Math.ceil(this.remainingMs / 1000)
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
    }
    point(x, y) { return { x: (x - this.offsetX) / this.scale, y: (y - this.offsetY) / this.scale } }
    inside(p, b) { return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h }
    down(x, y, touches) {
      const p = this.point(x, y)
      if (this.state === 'find' && this.findStage === 'playing' && !this.findHelpOpen && touches && touches.length >= 2) {
        const a = this.point(touches[0].clientX, touches[0].clientY)
        const b = this.point(touches[1].clientX, touches[1].clientY)
        const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2
        this.findPinch = {
          dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), zoom: this.findZoom,
          worldX: (x - this.findOffset.x) / this.findZoom, worldY: (y - this.findOffset.y) / this.findZoom
        }
        this.pressed = null
        this.findDrag = null
        return
      }
      this.rugSwipe = this.canSmoothRug() && this.inside(p, RUG_SWIPE_ZONE)
        ? { ...p, distance: 0 }
        : null
      const button = this.buttons.slice().reverse().find(b => this.inside(p, b))
      if (this.state === 'find' && this.findStage === 'playing' && !this.findHelpOpen && !this.find.complete && p.y >= 295) {
        this.pressed = button?.sceneItem ? button : null
        this.findDrag = { startX: p.x, startY: p.y, x: this.findOffset.x, y: this.findOffset.y }
        return
      }
      if (button) { this.pressed = button; return }
      if (this.state === 'teaser') {
        const teaser = this.teaser
        if (teaser.phase !== 'result' && Math.hypot(p.x - teaser.x, p.y - teaser.y) < 35) {
          teaser.dragging = true
          teaser.offsetX = teaser.x - p.x
          teaser.offsetY = teaser.y - p.y
        }
        return
      }
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
    move(x, y, touches) {
      if (this.state === 'find' && this.findPinch && touches && touches.length >= 2) {
        const a = this.point(touches[0].clientX, touches[0].clientY)
        const b = this.point(touches[1].clientX, touches[1].clientY)
        const dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))
        this.findZoom = Math.max(FIND_MIN_ZOOM, Math.min(FIND_MAX_ZOOM, this.findPinch.zoom * dist / this.findPinch.dist))
        this.panFind((a.x + b.x) / 2 - this.findPinch.worldX * this.findZoom,
          (a.y + b.y) / 2 - this.findPinch.worldY * this.findZoom)
        return
      }
      if (this.state === 'find' && this.findDrag) {
        const p = this.point(x, y)
        const dx = p.x - this.findDrag.startX, dy = p.y - this.findDrag.startY
        if (Math.hypot(dx, dy) > 7) {
          this.pressed = null
          this.panFind(this.findDrag.x + dx, this.findDrag.y + dy)
        }
        return
      }
      if (this.state === 'teaser' && this.teaser.dragging) {
        const p = this.point(x, y)
        this.moveTeaser(p.x + this.teaser.offsetX, p.y + this.teaser.offsetY, Date.now())
        return
      }
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
    up(x, y, touches) {
      if (this.state === 'find') {
        if (this.findPinch && (!touches || touches.length < 2)) this.findPinch = null
        this.findDrag = null
      }
      const wasPlaying = this.state === 'playing'
      if (wasPlaying) {
        this.updateClock(Date.now())
        if (this.state !== 'playing') return
      }
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
      if (this.state === 'find' && this.findStage === 'playing' && !this.findHelpOpen) {
        this.notify('这里没有要找的东西')
        return
      }
      if (this.state === 'teaser') {
        this.move(x, y)
        this.teaser.dragging = false
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
      if (!result) { this.notify('这里放不下，换个位置或先放另一块'); return }
      this.finishBoardAction(result)
    }
    finishBoardAction(result) {
      this.comboPop = null
      this.platform.write(this.key(), Math.max(this.best, this.game.score))
      this.best = Math.max(this.best, this.game.score)
      if (result.count) {
        this.platform.vibrate()
        this.notify(`${result.count > 1 ? '漂亮！' : '收好啦！'}清空 ${result.count} 条 · +${result.gained}`)
        this.effects = result.cleared.map(([cx, cy, color]) => ({ x: BX + cx * CELL + 21, y: BY + cy * CELL + 21, color, time: Date.now() }))
        const combo = this.game.combo
        if (combo > 1 || result.count > 1) {
          const label = combo > 1 ? `连消 ×${combo}` : `一手清 ${result.count} 条`
          const bonus = Math.max(0, result.count - 1) * 50 + Math.max(0, combo - 1) * 25
          this.comboPop = { label, bonus, time: Date.now() }
        }
      }
      if (result.gravity) {
        this.notify(result.count ? `零食向下落 · 清空 ${result.count} 条` : '柜子晃了一下，零食都向下落了')
      }
      this.selected = this.game.tray.findIndex(Boolean)
      if (this.mode === 'classic' && this.game.lines >= this.levelGoal) {
        this.clearedLevel = this.unlockedLevel
        this.earnedItem = this.levelReward
        this.care.grant('pantry', this.clearedLevel, this.earnedItem)
        this.state = 'cleared'
      } else if (result.over) { this.overReason = 'blocked'; this.state = 'over' }
      else if (!this.game.hasMoves()) this.notify('暂时放不下了，试试晃一下')
    }
    useGravity() {
      if (this.state !== 'playing' || !this.game.gravityReady) return
      const result = this.game.useGravity()
      if (result) this.finishBoardAction(result)
      else this.notify('现在没有能下落的零食')
    }
    useRescue() {
      if (this.state !== 'over') return
      if (this.overReason === 'time') {
        if (!this.game.spendTimeRescue()) return
        this.remainingMs = TIME_RESCUE_MS
        this.notify('多了 45 秒，接着收纳')
      } else {
        const cleared = this.game.rescueBoard()
        if (!cleared) return
        const now = Date.now()
        this.effects = cleared.map(([x, y, color]) => ({ x: BX + x * CELL + 21, y: BY + y * CELL + 21, color, time: now }))
        this.notify(`帮你腾出 ${cleared.length} 格，换块试试`)
      }
      this.overReason = null
      this.resumeBoard()
    }
    cancel() {
      this.pointer = null; this.pressed = null; this.rugSwipe = null
      if (this.teaser) this.teaser.dragging = false
    }
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
      this.effects = []; this.comboPop = null
      if (!this.game.hasMoves() && !this.game.previewGravity()) {
        this.overReason = 'blocked'
        this.state = 'over'
      } else {
        this.overReason = null
        this.resumeBoard()
        this.notify('已撤回上一步')
      }
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
      const board = this.game.board
      this.round(BX - 9, BY - 9, CELL * 7 + 18, CELL * 7 + 18, 22, '#ddd3c4')
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        this.round(BX + x * CELL + 2, BY + y * CELL + 3, CELL - 4, CELL - 4, 8, '#f6f1e8')
        if (board[y][x]) this.block(BX + x * CELL, BY + y * CELL, CELL, board[y][x])
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
    drawBoardStatus() {
      const now = Date.now()
      if (this.mode === 'classic') {
        const ready = this.game.rescueReady
        this.round(25, 38, 108, 30, 15, ready ? '#e3e8d4' : '#eee8dd')
        this.text(ready ? '救场 · 1 次' : '救场已用', 79, 53, 12, '#59664c', 'center', true)
        if (this.game.gravityReady) this.button('晃一下 ↓ · 1 次', 211, 34, 139, 37, () => this.useGravity(), true)
      }
      let caption = this.mode === 'classic' ? `通关奖励 · ${ITEMS[this.levelReward].name}` : '今日目标 · 800 分'
      let fill = null, ink = '#657356'
      if (this.comboPop && now - this.comboPop.time < 2300) {
        caption = `${this.comboPop.label}  +${this.comboPop.bonus} 分`; fill = '#674b35'; ink = '#fff2ce'
      } else if (this.messageUntil > now) {
        caption = this.message; fill = '#ebe6d7'; ink = '#514e44'
      } else if (this.mode === 'classic' && this.remainingMs <= 20000) {
        caption = this.game.rescueReady ? '时间快到了 · 还能救场续时' : '时间快到了'; fill = '#f2dbd1'; ink = '#9e4b3e'
      }
      if (fill) this.round(25, 105, 247, 29, 12, fill)
      this.text(caption, fill ? 36 : 27, 120, Math.min(13, 223 / [...caption].length), ink, 'left', Boolean(fill))
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
      this.namePickerOpen = false
      this.nameChoices = []
      this.nameChecking = false
      this.naming = false
      this.state = 'profile'
    }
    editName() {
      if (this.naming || this.nameChecking) return
      this.naming = true
      this.profileHint = ''
      this.platform.requestName(this.draftName, value => {
        this.naming = false
        if (typeof value !== 'string') return
        const name = value.trim()
        if (!name || name === this.draftName) return
        this.nameChecking = true
        this.profileHint = '正在检查名字…'
        this.platform.checkName(name, result => {
          this.nameChecking = false
          if (result && result.ok) {
            this.draftName = name
            this.profileHint = ''
            return
          }
          const code = result && result.code
          this.profileHint = (result && result.hint) || this.nameRejectText(code)
          if (code === 'NETWORK' || code === 'UNAVAILABLE' || code === 'ERROR') {
            this.namePickerOpen = true
            if (!this.nameChoices || !this.nameChoices.length) this.rollNames()
          }
        })
      })
    }
    nameRejectText(code) {
      if (code === 'RISKY' || code === 'REVIEW') return '这个名字包含不合适的内容，换一个吧'
      if (code === 'EMPTY') return '名字不能为空'
      if (code === 'LONG') return '最多 8 个字'
      if (code === 'CHARSET') return '只能用中文、字母或数字'
      if (code === 'REPEAT') return '不要重复同一个字'
      return '这个名字暂时不能用，换一个吧'
    }
    rollNames() {
      const pool = CAT_NAME_POOL.slice()
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = pool[i]; pool[i] = pool[j]; pool[j] = temp
      }
      this.nameChoices = pool.slice(0, NAME_PICK_COUNT)
    }
    pickName(name) {
      this.draftName = name
      this.namePickerOpen = false
      this.profileHint = ''
    }
    drawNamePicker() {
      this.buttons = []
      const c = this.ctx
      c.fillStyle = 'rgba(47,42,34,.55)'
      c.fillRect(0, 0, W, H)
      this.round(22, 200, 331, 440, 24, '#fffdf8')
      c.lineWidth = 3; c.strokeStyle = '#5d4b38'; c.stroke()
      this.text('给小猫选个名字', W / 2, 240, 22, '#454d38', 'center', true)
      this.text('名字检查不可用时，先从推荐里挑一个', W / 2, 268, 11, '#8d8a7d', 'center')
      const cols = 4, cw = 74, ch = 42, gap = 8
      const startX = (W - (cols * cw + (cols - 1) * gap)) / 2
      this.nameChoices.forEach((name, index) => {
        const x = startX + (index % cols) * (cw + gap)
        const y = 292 + Math.floor(index / cols) * (ch + 10)
        const active = name === this.draftName
        this.round(x, y + 3, cw, ch, 12, '#d8cbb8')
        this.round(x, y, cw, ch, 12, active ? '#49c4b6' : '#fffdf7')
        c.lineWidth = 2; c.strokeStyle = active ? '#24766f' : '#a2937c'; c.stroke()
        this.text(name, x + cw / 2, y + ch / 2, 16, active ? '#fff' : '#5d4b38', 'center', true)
        this.buttons.push({ x, y, w: cw, h: ch, action: () => this.pickName(name) })
      })
      this.findButton('换一批', 46, 556, 140, 42, () => this.rollNames())
      this.findButton('收起', 194, 556, 140, 42, () => { this.namePickerOpen = false })
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
      this.text('换名字 ›', 327, 575, 14, '#657356', 'right', true)
      this.buttons.push({ x: 25, y: 546, w: 325, h: 58, action: () => this.editName() })
      if (this.profileHint) this.text(this.profileHint, 27, 622, 13, '#9b5549')
      this.button(editing ? '保存档案' : '带它回家', 25, 641, 325, 58, () => {
        if (this.nameChecking) { this.profileHint = '名字还在检查，稍等一下。'; return }
        if (this.care.setProfile(this.draftCoat, this.draftName)) this.goHome()
        else this.profileHint = '名字不太合适，换一个试试。'
      }, true)
      if (editing) this.button('取消', 25, 711, 325, 44, () => this.goHome())
      if (this.namePickerOpen) this.drawNamePicker()
    }
    drawCatHome() {
      const titleSize = Math.min(30, 218 / ([...this.catName].length + 3))
      this.text(GAME_NAME, 26, 38, 10, '#969d82', 'left', true)
      this.text(`${this.catName}的猫窝`, 26, 66, titleSize, '#454d38', 'left', true)
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
      const mousePlay = !introducing && reacting && this.catAction === 'mouse'
      const bagPlay = !introducing && reacting && this.catAction === 'rustleBag'
      const toyAge = mousePlay || bagPlay ? now - this.catActionAt : 0
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
          mousePlay ? 182 + 39 * Math.min(1, toyAge / 900) : bagPlay ? 194 + 15 * Math.min(1, toyAge / 820) :
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
      } else if (idle || onCushion || introducing || chasing || settling || watching || tidying || mousePlay || bagPlay) {
        const pose = mousePlay ? (toyAge < 750 ? 'stretch' : 'groom') : bagPlay ? (toyAge < 750 ? 'walk' : 'sniff') :
          watching ? 'window' : tidying ? 'sniff' : chasing ? (roll < 1 ? 'walk' : 'groom') :
          settleWalk ? 'walk' : onCushion || settling ? 'rest' :
          introducing ? (intro >= 2450 ? 'groom' : intro >= 1250 ? 'sniff' : 'walk') : idle.pose
        this.drawCatFromSide(catX, onCushion ? 296 : 319, onCushion ? 1.05 : 1.15, pose,
          introducing || chasing || tidying || mousePlay || bagPlay ? 1 : (idle?.direction || -1), now)
      } else this.cat(catX, 235 + bob, 1.45, action)
      if (mousePlay || bagPlay) {
        const toyX = mousePlay ? 280 + 13 * Math.min(1, Math.max(0, (toyAge - 750) / 430)) : 254
        this.drawCabinetToy(this.catAction, toyX, 316, 1.05)
      }
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
      const canTakePhoto = (sleeping && !this.care.state.boxPhoto) || (onCushion && !this.care.state.cushionPhoto)
      this.button('猫咪档案', 149, 120, 89, 37, () => this.editProfile())
      this.button('相册', 244, 120, canTakePhoto ? 42 : 88, 37, () => {
        this.albumPage = !this.care.state.boxPhoto && this.care.state.cushionPhoto ? 1 : 0
        this.state = 'album'
      })
      if (canTakePhoto) {
        this.button('拍照', 291, 120, 41, 37, () => {
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
      Object.entries(ITEMS).filter(([id]) => ['food', 'water', 'box', 'scarf'].includes(id)).forEach(([id, item], index) => {
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
      const crouching = pose === 'crouch'
      const nuzzling = pose === 'nuzzle'
      const bodyY = resting ? -15 : crouching ? -20 : -28
      c.save(); c.translate(x, floor); c.scale(size * direction, size)
      const ellipse = (cx, cy, rx, ry, color) => {
        c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
        c.fillStyle = color; c.fill()
      }
      const line = (color, width) => { c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke() }
      c.beginPath(); c.moveTo(-27, -14)
      c.bezierCurveTo(-49, 0, -64, resting || back || crouching ? -3 : -17,
        -65, crouching ? -5 + beat * 3 : resting || back ? -5 : -25 + beat * 4)
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
      const headY = back ? -57 : resting ? -14 : crouching ? -21 : stretching ? -20 : nuzzling ? -31 + beat * 2 :
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
    drawCabinetToy(item, x, y, scale = 1) {
      const c = this.ctx
      c.save(); c.translate(x, y); c.scale(scale, scale)
      if (item === 'mouse') {
        this.drawRoomShadow(0, 9, 24, 5, '#76554135')
        c.strokeStyle = '#847383'; c.lineWidth = 2
        c.beginPath(); c.moveTo(-13, 3); c.quadraticCurveTo(-25, 8, -26, -1); c.stroke()
        this.drawRoomShadow(0, 0, 15, 9, '#a598a7')
        this.drawRoomShadow(11, -1, 8, 6, '#b6a5b0')
        this.drawRoomShadow(7, -7, 4, 4, '#e0a4a4')
        this.drawRoomShadow(15, -2, 1.4, 1.4, '#564957')
      } else {
        this.drawRoomShadow(0, 10, 25, 6, '#76554135')
        this.round(-21, -26, 42, 36, 7, '#c89163')
        this.round(-23, -28, 46, 9, 4, '#815a46')
        this.round(-11, -14, 23, 13, 3, '#e9bc91')
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
        { title: '逗猫棒', note: `陪猫抓住羽毛 · ${TEASER_PASS_SCORE} 分领礼物`, reward: this.teaserRewardLabel, color: '#f0e1ce', open: () => this.startTeaser() }
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
      this.button('猫窝找找找 · 寻物', 25, 585, 325, 48, () => this.openFindLevels(), true)
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
        else this.text(unlocked ? '使用中' : '去玩逗猫棒解锁', x + 68.5, 319, 12, '#69775f', 'center')
      })
      this.button('回去滚毛线球', 45, 389, 285, 49, () => {
        this.goHome(false)
        if (this.boxIntroAt === undefined) this.useItem('ball')
      }, true)
      for (const [index, item] of ['mouse', 'rustleBag'].entries()) {
        const x = 25 + index * 167
        const unlocked = this.care.count(item)
        this.round(x, 505, 158, 166, 17, '#ede0ce')
        this.drawCabinetToy(item, x + 79, 549, 1.25)
        this.text(ITEMS[item].name, x + 79, 591, 16, '#5b513f', 'center', true)
        if (unlocked) this.button(ITEMS[item].action, x + 13, 613, 132, 36, () => {
          this.goHome(false)
          if (this.boxIntroAt === undefined) this.useItem(item)
        })
        else this.text('去玩逗猫棒解锁', x + 79, 630, 12, '#69775f', 'center')
      }
    }
    get findReward() {
      if (!this.care.count('mouse')) return 'mouse'
      if (!this.care.count('rustleBag')) return 'rustleBag'
      if (!this.care.count('cushion')) return 'cushion'
      if (!this.care.count('ball')) return 'ball'
      if (!this.care.count('sageYarn')) return 'sageYarn'
      return this.care.completed(FIND_REWARD_SOURCE) % 2 ? 'food' : 'water'
    }
    get findRewardLabel() {
      const reward = this.findReward
      return reward === 'sageYarn' ? '鼠尾草绿毛线' : reward === 'cushion' ? '窗边软垫' : ITEMS[reward].name
    }
    openFindLevels() {
      this.cancel()
      this.state = 'find'
      this.findStage = 'levels'
    }
    startFind(round = Math.min(FIND_LEVELS.length, this.care.completed(FIND_REWARD_SOURCE) + 1)) {
      this.find = new FindGame(17041 + round * 7919, round)
      this.findStage = 'intro'
      this.findHintLeft = 1
      this.findHintId = null
      this.findHintUntil = 0
      this.findFlight = null
      this.findPrize = null
      this.findZoom = FIND_MIN_ZOOM
      this.findOffset = { x: 0, y: 0 }
      this.findPinch = null
      this.findDrag = null
      this.findHelpOpen = false
      this.cancel()
      this.state = 'find'
    }
    beginFind() {
      if (!this.find) return
      this.findStage = 'playing'
      this.findHelpOpen = !Number(this.platform.read(FIND_HELP_KEY) || 0)
      this.notify('按箱子分类收集，装满会换下一箱')
    }
    closeFindHelp() {
      this.findHelpOpen = false
      this.platform.write(FIND_HELP_KEY, 1)
    }
    zoomFind(delta) {
      const previous = this.findZoom
      this.findZoom = Math.max(FIND_MIN_ZOOM, Math.min(FIND_MAX_ZOOM, this.findZoom + delta))
      const ratio = this.findZoom / previous
      this.panFind(W / 2 + (this.findOffset.x - W / 2) * ratio, 540 + (this.findOffset.y - 540) * ratio)
    }
    panFind(x, y) {
      const excess = this.findZoom - 1
      this.findOffset.x = Math.max(-W * excess, Math.min(0, x))
      this.findOffset.y = Math.max(0 - H * excess, Math.min(0 - 295 * excess, y))
    }
    findSpotRect(spot) {
      const zoom = this.findZoom || 1
      return {
        x: spot.x * zoom + this.findOffset.x,
        y: spot.y * zoom + this.findOffset.y,
        w: spot.w * zoom,
        h: spot.h * zoom
      }
    }
    findHitRect(item) {
      return this.findSpotRect(item.spot)
    }
    drawFindCover(item) {
      const c = this.ctx
      const { x, y, w, h } = item.spot
      c.save(); c.translate(x + w / 2, y + h / 2)
      // 遮挡只绘制前景物件，露出目标的另一半。
      if (item.coverSide === 'bottom') {
        c.translate(0, h * .28); c.rotate(-.12)
        this.drawRoomShadow(1, h * .39, w * .58, 5, '#71543e52')
        this.round(-w * .62, -h * .22, w * 1.24, h * .72, 7, '#c7b492', '#9b8568')
        c.strokeStyle = '#a89170'; c.lineWidth = 1.3
        for (const fold of [0, 5, 10]) {
          c.beginPath(); c.moveTo(-w * .5, fold + 2)
          c.quadraticCurveTo(0, fold + 7, w * .5, fold - 2); c.stroke()
        }
        this.round(-w * .43, -h * .13, w * .72, 3, 1.5, '#e9d4af')
      } else if (item.coverSide === 'right') {
        c.translate(w * .26, 0); c.rotate(.16)
        this.round(-w * .35, -h * .62, w * .92, h * 1.24, 7, '#9db6a3', '#738b79')
        c.fillStyle = '#dce8d7'; c.fillRect(-w * .25, -h * .45, w * .16, h * .9)
      } else {
        c.translate(-w * .26, 0); c.rotate(-.18)
        this.round(-w * .57, -h * .62, w * .92, h * 1.24, 7, '#d8ab89', '#ad7d5f')
        this.round(-w * .44, -h * .4, w * .6, h * .22, 4, '#f3d8bd')
      }
      c.restore()
    }
    findSticker(w, h, inner, rot = 0) {
      const c = this.ctx
      const r = Math.min(w, h) * .32
      const path = () => {
        c.beginPath(); c.moveTo(-w / 2 + r, -h / 2)
        c.arcTo(w / 2, -h / 2, w / 2, h / 2, r)
        c.arcTo(w / 2, h / 2, -w / 2, h / 2, r)
        c.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r)
        c.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r)
        c.closePath()
      }
      c.save(); c.rotate(rot)
      c.save(); c.translate(3, 5); path(); c.fillStyle = 'rgba(70,52,34,.22)'; c.fill(); c.restore()
      if (inner) inner(c)
      c.restore()
    }
    drawFindProp(x, y, w, h, rot, color, type) {
      const c = this.ctx
      c.save(); c.translate(x, y)
      this.findSticker(w, h, cc => {
        cc.lineWidth = 2; cc.strokeStyle = '#6b5842'
        if (type === 'book') {
          this.round(-w / 2 + 5, -h / 2 + 4, w - 10, h - 8, 4, color, '#6b5842')
          cc.beginPath(); cc.moveTo(-w / 2 + 12, -h / 2 + 4); cc.lineTo(-w / 2 + 12, h / 2 - 4); cc.stroke()
          cc.fillStyle = '#fff4d8'; cc.fillRect(-w / 2 + 18, -h / 2 + 10, w - 32, 4)
          cc.fillRect(-w / 2 + 18, -h / 2 + 18, w - 42, 3)
        } else if (type === 'paper') {
          this.round(-w / 2 + 5, -h / 2 + 4, w - 10, h - 8, 3, '#fffdf4', '#9a866a')
          cc.strokeStyle = '#b6a68c'
          for (let i = 0; i < 3; i++) {
            cc.beginPath(); cc.moveTo(-w / 2 + 12, -h / 2 + 13 + i * 9); cc.lineTo(w / 2 - 12 - i * 5, -h / 2 + 13 + i * 9); cc.stroke()
          }
        } else if (type === 'quilt') {
          this.round(-w * .49, -h * .43, w * .98, h * .86, 12, color, '#805f51')
          cc.save(); cc.clip()
          for (let stripe = -w / 2 + 7; stripe < w / 2; stripe += 13) {
            cc.fillStyle = '#fff2cc66'; cc.fillRect(stripe, -h / 2, 4, h)
          }
          cc.restore()
          this.round(-w * .45, h * .18, w * .89, h * .23, 7, '#a9705c', '#805f51')
          this.round(-w * .43, h * .17, w * .86, 4, 2, '#f2c5a0')
        } else if (type === 'plush') {
          this.drawRoomShadow(0, h * .29, w * .42, h * .14, '#77543c55')
          this.round(-w * .29, -h * .01, w * .58, h * .45, 14, color, '#8b664e')
          for (const side of [-1, 1]) {
            this.round(side * w * .22 - 8, -h * .37, 16, 16, 8, color, '#8b664e')
            this.round(side * w * .22 - 6, h * .26, 13, 13, 6, '#ebbd8a', '#8b664e')
          }
          this.round(-w * .34, -h * .26, w * .68, h * .42, 14, color, '#8b664e')
          this.round(-8, -2, 16, 9, 5, '#f8d8af')
          this.round(-3, 0, 6, 3, 1.5, '#664d3f')
          this.round(-9, -7, 3, 4, 1.5, '#664d3f')
          this.round(6, -7, 3, 4, 1.5, '#664d3f')
        } else if (type === 'shirt') {
          cc.fillStyle = color
          cc.beginPath(); cc.moveTo(-w * .28, -h / 2 + 6); cc.lineTo(-w / 2 + 6, -h / 2 + 18)
          cc.lineTo(-w * .32, -h / 2 + 28); cc.lineTo(-w * .2, -h / 2 + 22)
          cc.lineTo(-w * .2, h / 2 - 5); cc.lineTo(w * .2, h / 2 - 5); cc.lineTo(w * .2, -h / 2 + 22)
          cc.lineTo(w * .32, -h / 2 + 28); cc.lineTo(w / 2 - 6, -h / 2 + 18)
          cc.lineTo(w * .28, -h / 2 + 6); cc.closePath(); cc.fill(); cc.stroke()
          cc.strokeStyle = '#fff7db78'; cc.lineWidth = 1.5
          cc.beginPath(); cc.moveTo(-w * .11, -h * .24)
          cc.quadraticCurveTo(0, -h * .1, w * .11, -h * .24); cc.stroke()
          cc.beginPath(); cc.moveTo(-w * .16, h * .29); cc.lineTo(w * .16, h * .29); cc.stroke()
        } else if (type === 'ball') {
          cc.fillStyle = color; cc.beginPath(); cc.arc(0, 0, Math.min(w, h) * .34, 0, Math.PI * 2); cc.fill(); cc.stroke()
          cc.beginPath(); cc.arc(0, 0, Math.min(w, h) * .34, -.9, .9); cc.stroke()
          cc.beginPath(); cc.arc(0, 0, Math.min(w, h) * .34, 2.2, 4); cc.stroke()
        } else if (type === 'glasses') {
          cc.strokeStyle = '#4e4a45'; cc.lineWidth = 3
          cc.beginPath(); cc.arc(-w * .2, 0, w * .17, 0, Math.PI * 2); cc.stroke()
          cc.beginPath(); cc.arc(w * .2, 0, w * .17, 0, Math.PI * 2); cc.stroke()
          cc.beginPath(); cc.moveTo(-w * .03, 0); cc.lineTo(w * .03, 0); cc.stroke()
        } else if (type === 'phone') {
          this.round(-w * .26, -h / 2 + 4, w * .52, h - 8, 5, '#3f4a52', '#2c353b')
          cc.fillStyle = color; cc.fillRect(-w * .22, -h / 2 + 10, w * .44, h - 22)
        } else if (type === 'sock') {
          cc.fillStyle = color
          cc.beginPath(); cc.ellipse(0, h * .1, w * .28, h * .34, -.2, 0, Math.PI * 2); cc.fill(); cc.stroke()
          cc.fillRect(-w * .28, -h / 2 + 6, w * .56, h * .34); cc.strokeRect(-w * .28, -h / 2 + 6, w * .56, h * .34)
        } else if (type === 'bag') {
          cc.fillStyle = color
          cc.beginPath(); cc.moveTo(-w * .34, -h * .1); cc.lineTo(w * .34, -h * .1)
          cc.lineTo(w * .27, h / 2 - 4); cc.lineTo(-w * .27, h / 2 - 4); cc.closePath(); cc.fill(); cc.stroke()
          cc.strokeStyle = '#4c4036'; cc.lineWidth = 3
          cc.beginPath(); cc.arc(0, -h * .1, w * .24, Math.PI, 0); cc.stroke()
        } else {
          cc.fillStyle = color; cc.beginPath(); cc.arc(0, 0, Math.min(w, h) * .3, 0, Math.PI * 2); cc.fill(); cc.stroke()
        }
      }, rot)
      c.restore()
    }
    findButton(label, x, y, w, h, action, primary = false) {
      const c = this.ctx
      this.round(x, y + 4, w, h, 12, primary ? '#2c8b82' : '#cbbda9')
      this.round(x, y, w, h, 12, primary ? '#49c4b6' : '#fffdf7')
      c.lineWidth = 2.5; c.strokeStyle = primary ? '#24766f' : '#7a6a55'; c.stroke()
      this.text(label, x + w / 2, y + h / 2, primary ? 14 : 14, primary ? '#fff' : '#5d4b38', 'center', true)
      this.buttons.push({ x, y, w, h, action })
    }
    drawFindClutter() {
      const props = [
        [113, 391, 126, 90, -.32, '#c59075', 'quilt'],
        [252, 459, 151, 98, .26, '#ca9b7f', 'quilt'],
        [131, 554, 160, 112, .23, '#c6846e', 'quilt'],
        [258, 627, 126, 86, -.27, '#cf9d82', 'quilt'],
        [306, 368, 68, 75, .19, '#d8a374', 'plush'],
        [166, 474, 61, 70, -.32, '#dfaf85', 'plush'],
        [68, 648, 66, 76, .26, '#d6a177', 'plush'],
        [70, 338, 62, 44, -.14, '#d9a86b', 'book'], [300, 346, 56, 40, .17, '#8fb8d0', 'shirt'],
        [186, 352, 46, 44, -.2, '#e0a0a0', 'ball'], [112, 382, 60, 38, .12, '#b8c9a2', 'paper'],
        [252, 386, 54, 40, -.16, '#e5bd72', 'book'], [54, 432, 44, 46, .2, '#9fb8c9', 'sock'],
        [318, 440, 50, 42, -.12, '#d3a3a0', 'bag'], [150, 448, 58, 40, .1, '#c3d3b0', 'paper'],
        [222, 466, 48, 46, -.22, '#e6c16f', 'ball'], [82, 492, 58, 42, .14, '#a9c0d4', 'book'],
        [292, 506, 56, 40, -.1, '#cfb7d4', 'shirt'], [186, 512, 46, 44, .18, '#e8b98f', 'glasses'],
        [54, 552, 50, 44, -.15, '#b9cfa8', 'bag'], [322, 560, 52, 46, .16, '#d9a3a3', 'sock'],
        [120, 572, 58, 40, .12, '#8fb8d0', 'phone'], [244, 590, 54, 42, -.18, '#e2c27c', 'paper'],
        [74, 620, 56, 44, -.12, '#c8b2d2', 'book'], [300, 626, 48, 46, .2, '#9fc0a8', 'ball'],
        [168, 640, 62, 40, .1, '#e7b57f', 'shirt'], [226, 668, 50, 42, -.16, '#a7bed0', 'sock'],
        [106, 686, 54, 40, .14, '#d6b58f', 'paper'], [292, 696, 58, 42, -.12, '#b7cda6', 'book'],
        [46, 700, 48, 44, .18, '#d9a5a5', 'ball'], [190, 706, 52, 40, -.2, '#c9b8d8', 'bag']
      ]
      props.forEach(args => this.drawFindProp(...args))
    }
    useFindHint() {
      if (!this.find || this.find.complete || !this.findHintLeft) return
      const next = this.find.unfound().find(item => this.find.boxes.some(box => box?.category === item.category))
      if (!next) return
      this.findHintLeft--
      this.findHintId = next.id
      this.findHintUntil = Date.now() + FIND_HINT_MS
      const rect = this.findSpotRect(next.spot)
      this.panFind(this.findOffset.x + W / 2 - rect.x - rect.w / 2,
        this.findOffset.y + 545 - rect.y - rect.h / 2)
      this.notify('提示：看红圈位置')
    }
    findItem(id) {
      if (!this.find || this.state !== 'find' || this.find.complete) return
      const item = this.find.unfound().find(entry => entry.id === id)
      if (!item) return
      if (item.covered) {
        item.covered = false
        this.notify('移开了上层杂物，再点一下收集')
        return
      }
      const boxIndex = this.find.boxes.findIndex(box => box?.category === item.category)
      const result = this.find.collect(id)
      if (!result.ok) {
        this.notify('托盘满了，先找当前箱子需要的物品')
        return
      }
      const slot = this.find.tray.indexOf(item)
      const to = result.staged ? { x: 39 + slot * 43, y: 183 } : { x: 53 + boxIndex * 112, y: 113 }
      this.findFlight = { item, to, from: this.findSpotRect(item.spot), at: Date.now() }
      this.notify(result.filled ? `装满 ${result.filled} 箱 · 已装 ${this.find.filled}/6 箱` :
        result.staged ? `${result.label}先放托盘，等对应箱子` : `找到${result.label}，已装箱`)
      if (result.complete && !this.findPrize) {
        const reward = this.findReward
        const label = this.findRewardLabel
        this.findPrize = this.care.grant(FIND_REWARD_SOURCE, this.find.round, reward) ? label : '本关已领过'
      }
    }
    drawFindRoom(now) {
      const c = this.ctx
      // 窗座的木框、墙面暗部和床沿共用暖色描边。
      const wall = c.createLinearGradient(0, 294, W, 431)
      wall.addColorStop(0, '#fff1d9'); wall.addColorStop(1, '#d3aa88')
      c.fillStyle = wall; c.fillRect(0, 284, W, 150)
      this.round(272, 289, 103, 103, 12, '#bd8a5c', '#785740')
      this.round(279, 297, 89, 82, 8, '#daeae0', '#a7734b')
      c.fillStyle = '#86ad70'
      c.beginPath(); c.ellipse(327, 363, 33, 15, 0, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.ellipse(350, 357, 17, 20, 0, 0, Math.PI * 2); c.fill()
      this.round(317, 297, 5, 81, 2, '#f1d6ae')
      this.round(271, 377, 105, 13, 4, '#e8bc8b', '#926443')
      // 木地板
      c.fillStyle = '#c9935d'; c.fillRect(0, 390, W, H - 390)
      c.strokeStyle = '#b17d4a'; c.lineWidth = 2
      for (let y = 412; y < H; y += 46) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke() }
      for (let y = 414; y < H; y += 46) {
        for (let x = 28 + (y % 3) * 24; x < W; x += 92) {
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + 11, y + 44); c.stroke()
        }
      }
      // 床头板（左）
      this.round(-6, 300, 52, 440, 8, '#c99a61', '#956b3d')
      c.strokeStyle = '#ad7d4a'; c.lineWidth = 2
      for (let y = 336; y < 730; y += 48) { c.beginPath(); c.moveTo(6, y); c.lineTo(38, y); c.stroke() }
      // 床垫侧面厚度 + 上表面（轻微梯形，斜俯视）
      this.drawRoomShadow(188, 727, 180, 29, '#79574156')
      c.fillStyle = '#a57553'
      c.beginPath(); c.moveTo(20, 314); c.lineTo(340, 304)
      c.lineTo(366, 737); c.lineTo(14, 750); c.closePath(); c.fill()
      c.strokeStyle = '#75513e'; c.lineWidth = 2; c.stroke()
      this.round(45, 724, 117, 14, 5, '#c5946a', '#886047')
      this.round(174, 720, 116, 14, 5, '#c5946a', '#886047')
      this.round(95, 730, 19, 3, 2, '#694e3b')
      this.round(222, 726, 19, 3, 2, '#694e3b')
      const quilt = c.createLinearGradient(20, 295, 349, 710)
      const room = this.find.rules.room
      quilt.addColorStop(0, room.light); quilt.addColorStop(.55, room.mid); quilt.addColorStop(1, room.dark)
      c.fillStyle = quilt
      c.beginPath(); c.moveTo(20, 300); c.lineTo(340, 290)
      c.lineTo(358, 710); c.lineTo(14, 720); c.closePath(); c.fill()
      c.strokeStyle = '#7d9a66'; c.lineWidth = 2; c.stroke()
      c.strokeStyle = '#e2ecc36b'; c.lineWidth = 1.3
      for (let i = 1; i < 6; i++) {
        const t = i / 6
        c.beginPath(); c.moveTo(20 + 320 * t, 290 + 10 * t); c.lineTo(14 + 344 * t, 720); c.stroke()
      }
      for (let y = 360; y < 700; y += 56) {
        const t = (y - 290) / 430
        c.beginPath(); c.moveTo(18 + 4 * t, y); c.lineTo(344 + 14 * t, y - 8 * t); c.stroke()
      }
      // 枕头边缘加缝线和压痕。
      ;[[52, 306, 116, 54, '#fff8e8'], [212, 302, 116, 54, '#f6e8d2']].forEach(p => {
        this.round(p[0], p[1], p[2], p[3], 16, 'rgba(70,52,34,.16)')
        this.round(p[0] - 2, p[1] - 2, p[2], p[3], 16, p[4], '#b9a588')
        this.round(p[0] + 4, p[1] + 4, p[2] - 12, p[3] - 12, 12, null, '#d3bca0')
        c.beginPath(); c.moveTo(p[0] + 10, p[1] + 18)
        c.quadraticCurveTo(p[0] + 20, p[1] + 15, p[0] + 29, p[1] + 21)
        c.strokeStyle = '#957b625c'; c.lineWidth = 1.3; c.stroke()
      })
      // 床头柜上的小熊摆件
      this.round(366, 330, 68, 126, 8, '#3f6b5c', '#2d5045')
      c.fillStyle = '#2d5045'; c.fillRect(371, 372, 58, 2); c.fillRect(371, 410, 58, 2)
      c.fillStyle = '#d9b77a'
      c.beginPath(); c.arc(382, 354, 5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(418, 354, 5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(400, 354, 13, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#5b432c'
      c.beginPath(); c.arc(396, 352, 1.5, 0, Math.PI * 2); c.fill()
      c.beginPath(); c.arc(404, 352, 1.5, 0, Math.PI * 2); c.fill()
      this.drawCatFromSide(318, 775, .62, 'rest', -1, now)
    }
    drawFindItem(item, highlight) {
      const c = this.ctx
      const { x, y, w, h } = item.spot
      if (highlight) {
        c.strokeStyle = '#d1594b'; c.lineWidth = 3
        c.beginPath(); c.arc(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 7, 0, Math.PI * 2); c.stroke()
      }
      c.save(); c.translate(x + w / 2, y + h / 2)
      c.rotate(item.rot || 0); c.scale(w / 50, h / 50)
      this.drawRoomShadow(2, 12, 17, 7, '#51413642')
      if (item.id === 'chips') {
        this.round(-18, -20, 36, 40, 6, '#f2c86a', '#a97a3d')
        this.round(-17, -19, 34, 5, 2, '#bd8748')
        this.round(-17, 14, 34, 5, 2, '#d7a251')
        c.fillStyle = '#fff3c4'; c.beginPath(); c.ellipse(0, -3, 11, 13, 0, 0, Math.PI * 2); c.fill()
        this.drawRoomShadow(-3, -3, 5, 3, '#e3a753')
        this.drawRoomShadow(3, 1, 5, 3, '#edb85e')
      } else if (item.id === 'lollipop') {
        c.strokeStyle = '#9a7551'; c.lineWidth = 3
        c.beginPath(); c.moveTo(0, 8); c.lineTo(0, 23); c.stroke()
        c.fillStyle = '#e58c8c'; c.beginPath(); c.arc(0, -3, 15, 0, Math.PI * 2); c.fill()
        c.strokeStyle = '#fff1d4'; c.lineWidth = 2
        c.beginPath(); c.arc(0, -3, 8, 0, Math.PI * 1.6); c.stroke()
      } else if (item.id === 'biscuit') {
        c.fillStyle = '#e8bd78'; c.beginPath(); c.arc(0, 0, 17, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#9a6d45'
        ;[[-7, -4], [5, -7], [7, 6], [-5, 8]].forEach(([dx, dy]) => { c.beginPath(); c.arc(dx, dy, 2, 0, Math.PI * 2); c.fill() })
      } else if (item.id === 'icecream') {
        c.fillStyle = '#d9a86b'
        c.beginPath(); c.moveTo(-12, 2); c.lineTo(12, 2); c.lineTo(0, 22); c.closePath(); c.fill()
        c.fillStyle = '#f4d3d8'; c.beginPath(); c.arc(0, -4, 13, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'candy') {
        c.fillStyle = '#f0b7c4'
        c.beginPath(); c.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#f7e6bd'
        c.beginPath(); c.moveTo(-14, 0); c.lineTo(-24, -8); c.lineTo(-21, 8); c.closePath(); c.fill()
        c.beginPath(); c.moveTo(14, 0); c.lineTo(24, -8); c.lineTo(21, 8); c.closePath(); c.fill()
      } else if (item.id === 'frame') {
        this.round(-19, -17, 38, 34, 4, '#a97849', '#7b5736')
        this.round(-14, -12, 28, 24, 2, '#f7eedb')
        c.fillStyle = '#9bb98a'; c.beginPath(); c.arc(0, 2, 7, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'polaroid') {
        this.round(-16, -19, 32, 38, 3, '#fffdf8', '#b5a68f')
        c.fillStyle = '#bcd3cf'; c.fillRect(-12, -14, 24, 21)
        c.fillStyle = '#e8bd78'; c.beginPath(); c.arc(0, -4, 6, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'album') {
        this.round(-18, -15, 36, 30, 4, '#cf9f7d', '#8d684e')
        c.fillStyle = '#f4e2c2'; c.fillRect(-11, -10, 22, 20)
        c.strokeStyle = '#8d684e'; c.lineWidth = 1.5
        c.beginPath(); c.moveTo(-18, 0); c.lineTo(-11, 0); c.stroke()
      } else if (item.id === 'postcard') {
        this.round(-19, -13, 38, 26, 3, '#f7efd9', '#ad9874')
        c.fillStyle = '#dc9a83'; c.fillRect(8, -9, 7, 7)
        c.strokeStyle = '#9db3a0'; c.lineWidth = 1.5
        c.beginPath(); c.moveTo(-14, 7); c.lineTo(-4, -4); c.lineTo(3, 4); c.stroke()
      } else if (item.id === 'film') {
        this.round(-19, -13, 38, 26, 3, '#544a45')
        c.fillStyle = '#efe4cc'; c.fillRect(-12, -7, 24, 14)
        c.fillStyle = '#544a45'
        for (let i = -14; i <= 14; i += 7) { c.fillRect(i, -11, 4, 3); c.fillRect(i, 8, 4, 3) }
      } else if (item.id === 'yarn') {
        c.fillStyle = '#d88684'; c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fill()
        c.strokeStyle = '#b65e62'; c.lineWidth = 1.6
        c.beginPath(); c.arc(0, 0, 10, .2, Math.PI * 1.7); c.stroke()
        c.beginPath(); c.arc(0, 0, 15, 2.2, Math.PI * 2.8); c.stroke()
      } else if (item.id === 'mouse') {
        c.fillStyle = '#9aa5a0'
        c.beginPath(); c.ellipse(0, 2, 15, 10, 0, 0, Math.PI * 2); c.fill()
        c.strokeStyle = '#6f7a75'; c.lineWidth = 2
        c.beginPath(); c.arc(13, 3, 8, -1.2, 1.4); c.stroke()
        c.fillStyle = '#4b514e'; c.beginPath(); c.arc(-9, -1, 2, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'controller') {
        this.round(-19, -11, 38, 22, 8, '#ddd9d2', '#8e8981')
        c.fillStyle = '#7d878c'; c.fillRect(-9, -2, 18, 5)
        c.fillStyle = '#a86d68'; c.beginPath(); c.arc(-11, -4, 2.5, 0, Math.PI * 2); c.fill()
        c.fillStyle = '#7f9a7c'; c.beginPath(); c.arc(11, 2, 2.5, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'headphone') {
        c.strokeStyle = '#6e7d84'; c.lineWidth = 4
        c.beginPath(); c.arc(0, 2, 14, Math.PI * 1.05, Math.PI * 1.95); c.stroke()
        this.round(-18, 0, 8, 15, 3, '#8fa0a6')
        this.round(10, 0, 8, 15, 3, '#8fa0a6')
      } else if (item.id === 'ball') {
        c.fillStyle = '#e4b45f'; c.beginPath(); c.arc(0, 0, 15, 0, Math.PI * 2); c.fill()
        c.strokeStyle = '#a97a3d'; c.lineWidth = 2
        c.beginPath(); c.arc(0, 0, 15, -.9, .9); c.stroke()
        c.beginPath(); c.arc(0, 0, 15, 2.2, 4); c.stroke()
      } else if (item.id === 'cap') {
        c.fillStyle = '#8fa9c4'; c.beginPath(); c.arc(0, 0, 15, Math.PI, 0); c.fill()
        c.fillStyle = '#6b89a8'; this.round(-20, -1, 40, 7, 3, '#6b89a8')
        c.fillStyle = '#d8e2ec'; c.beginPath(); c.arc(0, -13, 3, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'strawHat') {
        c.fillStyle = '#e4c887'; c.beginPath(); c.ellipse(0, 7, 20, 6, 0, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(0, -2, 12, Math.PI, 0); c.fill()
        c.strokeStyle = '#b08c52'; c.lineWidth = 2
        c.beginPath(); c.moveTo(-11, 6); c.lineTo(11, 6); c.stroke()
      } else if (item.id === 'beanie') {
        c.fillStyle = '#d59a9a'; c.beginPath(); c.arc(0, 2, 15, Math.PI, 0); c.fill()
        this.round(-16, 0, 32, 8, 3, '#b97878')
        c.fillStyle = '#f6e8d5'; c.beginPath(); c.arc(0, -14, 4, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'beret') {
        c.fillStyle = '#9d8bb1'; c.beginPath(); c.ellipse(-2, -4, 17, 12, -.2, 0, Math.PI * 2); c.fill()
        this.round(-11, 4, 22, 5, 2, '#786888')
        c.fillStyle = '#c5b4d2'; c.beginPath(); c.arc(0, -15, 2.5, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'helmet') {
        c.fillStyle = '#e0a75e'; c.beginPath(); c.arc(0, 2, 16, Math.PI, 0); c.fill()
        this.round(-19, 0, 38, 6, 3, '#b98545')
        c.fillStyle = '#fff1cd'; c.fillRect(-2, -13, 4, 10)
      } else if (item.id === 'car') {
        this.round(-19, -6, 38, 15, 6, '#d96b6b', '#92545a')
        this.round(-11, -13, 20, 11, 5, '#bfd9d6', '#92545a')
        this.round(-16, -4, 24, 2, 1, '#f2ac9d')
        this.round(14, 0, 4, 4, 2, '#f7db9a')
        c.fillStyle = '#4a4f55'
        c.beginPath(); c.arc(-11, 9, 4, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(11, 9, 4, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'bus') {
        this.round(-20, -12, 40, 24, 5, '#e6b35f')
        c.fillStyle = '#bcd7d4'; c.fillRect(-15, -8, 30, 9)
        c.fillStyle = '#4a4f55'
        c.beginPath(); c.arc(-11, 12, 4, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(11, 12, 4, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'train') {
        this.round(-19, -11, 38, 20, 5, '#7e9bb6')
        c.fillStyle = '#dceaf2'; c.fillRect(-13, -7, 9, 8); c.fillRect(3, -7, 9, 8)
        c.fillStyle = '#4a4f55'
        c.beginPath(); c.arc(-10, 10, 4, 0, Math.PI * 2); c.fill()
        c.beginPath(); c.arc(10, 10, 4, 0, Math.PI * 2); c.fill()
      } else if (item.id === 'plane') {
        c.fillStyle = '#f2f0e8'
        c.beginPath(); c.moveTo(0, -18); c.lineTo(5, 4); c.lineTo(19, 10); c.lineTo(19, 15); c.lineTo(3, 11); c.lineTo(2, 17); c.lineTo(8, 20); c.lineTo(8, 23); c.lineTo(-3, 21); c.lineTo(-4, 11); c.lineTo(-19, 15); c.lineTo(-19, 10); c.lineTo(-5, 4); c.closePath(); c.fill()
        c.fillStyle = '#8fb8d0'; c.fillRect(-2, -8, 4, 12)
      } else if (item.id === 'bike') {
        c.strokeStyle = '#6d7d84'; c.lineWidth = 2
        c.beginPath(); c.arc(-12, 5, 8, 0, Math.PI * 2); c.stroke()
        c.beginPath(); c.arc(12, 5, 8, 0, Math.PI * 2); c.stroke()
        c.beginPath(); c.moveTo(-12, 5); c.lineTo(-3, -6); c.lineTo(8, -6); c.lineTo(12, 5); c.lineTo(-3, -6); c.lineTo(3, 5); c.stroke()
        c.strokeStyle = '#d59a6a'; c.beginPath(); c.moveTo(-6, -8); c.lineTo(2, -8); c.stroke()
      }
      c.restore()
    }
    drawFindResult() {
      this.buttons = []
      const c = this.ctx
      c.fillStyle = '#2f2a2259'
      c.fillRect(0, 0, W, H)
      this.round(35, 300, 305, 220, 22, '#fffdf8')
      this.text('全找到啦！', W / 2, 348, 27, '#454d38', 'center', true)
      this.text(this.findPrize === '本关已领过' ? '本关礼物已领取' : `带回猫窝 · ${this.findPrize || '礼物'}`, W / 2, 391, 15, '#657356', 'center')
      const next = this.find.round + 1
      this.button(next <= FIND_LEVELS.length ? '下一关' : '返回选关', 55, 442, 265, 45,
        () => next <= FIND_LEVELS.length ? this.startFind(next) : this.openFindLevels(), true)
      this.button('回猫窝', 55, 496, 265, 42, () => this.goHome())
    }
    drawFindScenePreview(x, y, width, height) {
      const c = this.ctx
      c.save()
      this.round(x, y, width, height, 18, '#d8ba97')
      c.clip()
      const scale = width / W
      c.translate(x, y - 295 * scale)
      c.scale(scale, scale)
      this.drawFindRoom(Date.now())
      this.drawFindClutter()
      for (const item of this.find.items) {
        if (item.found) continue
        this.drawFindItem(item, false)
        if (item.covered) this.drawFindCover(item)
      }
      c.restore()
    }
    drawFindIntro() {
      const c = this.ctx
      c.fillStyle = '#f7efe1'; c.fillRect(0, 0, W, H)
      this.button('选关', 25, 46, 90, 38, () => this.openFindLevels())
      this.text('猫窝找找找', 26, 124, 33, '#454d38', 'left', true)
      this.text(`第 ${this.find.round} 关 · ${this.find.rules.room.name} · 装满 6 箱`, 27, 160, 13, '#795a46')
      this.drawFindScenePreview(25, 187, 325, 397)
      this.button('进房间找东西', 25, 611, 325, 54, () => this.beginFind(), true)
    }
    drawFindHelp() {
      this.buttons = []
      const c = this.ctx
      c.fillStyle = '#2f2a2259'
      c.fillRect(0, 0, W, H)
      this.round(45, 205, 285, 370, 18, '#fff4dc')
      this.round(45, 205, 285, 68, 18, '#f3bd55')
      c.fillStyle = '#f3bd55'; c.fillRect(45, 245, 285, 28)
      this.text('提 示', W / 2, 239, 28, '#fff', 'center', true)
      this.text('双指可以放大和缩小场景屏幕', W / 2, 300, 14, '#9d6a45', 'center')
      this.round(105, 330, 165, 150, 14, '#e9d8b4')
      c.fillStyle = '#c9a97a'; c.fillRect(118, 440, 139, 10)
      c.fillStyle = '#8aa5ae'; c.beginPath(); c.arc(150, 390, 12, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#d99a78'; c.beginPath(); c.arc(210, 410, 14, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#fffdf8'; c.strokeStyle = '#8d7352'; c.lineWidth = 2
      c.beginPath(); c.ellipse(158, 425, 13, 18, -.35, 0, Math.PI * 2); c.fill(); c.stroke()
      c.beginPath(); c.ellipse(212, 447, 13, 18, .35, 0, Math.PI * 2); c.fill(); c.stroke()
      c.strokeStyle = '#b9584c'; c.lineWidth = 2
      c.beginPath(); c.moveTo(174, 415); c.lineTo(198, 402); c.stroke()
      c.beginPath(); c.moveTo(196, 402); c.lineTo(195, 413); c.moveTo(196, 402); c.lineTo(206, 406); c.stroke()
      c.beginPath(); c.moveTo(198, 458); c.lineTo(175, 470); c.stroke()
      c.beginPath(); c.moveTo(177, 470); c.lineTo(178, 459); c.moveTo(177, 470); c.lineTo(167, 466); c.stroke()
      this.round(75, 500, 225, 52, 14, '#42b5a6')
      this.text('好的', W / 2, 526, 18, '#fff', 'center', true)
      this.buttons.push({ x: 75, y: 500, w: 225, h: 52, action: () => this.closeFindHelp() })
    }
    drawFindLevels() {
      const completed = this.care.completed(FIND_REWARD_SOURCE)
      this.text('猫窝找找找', 25, 75, 29, '#454d38', 'left', true)
      this.button('小游戏', 230, 53, 103, 37, () => { this.state = 'activities' })
      FIND_LEVELS.forEach((level, index) => {
        const column = index % 4
        const x = 25 + column * 83, y = 172 + Math.floor(index / 4) * 157
        const round = index + 1
        if (column === 0) {
          this.round(25, y - 38, 325, 110, 16, level.room.light)
          this.text(level.room.name, 38, y - 17, 17, '#454d38', 'left', true)
        }
        if (round <= completed + 1) {
          this.button(round <= completed ? `${round} ✓` : `${round}`, x + 7, y + 6, 64, 43, () => this.startFind(round), round === completed + 1)
        } else {
          this.round(x + 7, y + 6, 64, 43, 12, '#e5ddcf')
          this.text(`${round} 未解锁`, x + 39, y + 28, 11, '#685d52', 'center')
        }
      })
    }
    drawFind() {
      if (this.findStage === 'levels') { this.drawFindLevels(); return }
      if (!this.find) return
      if (this.findStage === 'intro') { this.drawFindIntro(); return }
      const now = Date.now()
      const c = this.ctx
      c.save()
      c.beginPath(); c.rect(0, 295, W, H - 295); c.clip()
      c.translate(this.findOffset.x, this.findOffset.y)
      c.scale(this.findZoom, this.findZoom)
      this.drawFindRoom(now)
      this.drawFindClutter()
      const highlight = now < this.findHintUntil ? this.findHintId : null
      this.find.items.forEach(item => {
        if (item.found) return
        this.drawFindItem(item, item.id === highlight)
      })
      this.find.items.forEach(item => {
        if (item.found || !item.covered) return
        this.drawFindCover(item)
      })
      c.restore()
      this.find.items.forEach(item => {
        if (item.found) return
        const rect = this.findHitRect(item)
        const y = Math.max(295, rect.y)
        const h = Math.min(H, rect.y + rect.h) - y
        if (h > 0) this.buttons.push({ ...rect, y, h, sceneItem: true, action: () => this.findItem(item.id) })
      })
      this.text(GAME_NAME, 26, 38, 10, '#7d826b', 'left', true)
      this.text('猫窝找找找', 26, 72, 25, '#454d38', 'left', true)
      this.findButton('小游戏', 151, 48, 89, 39, () => { this.cancel(); this.state = 'activities' })
      this.findButton('回猫窝', 261, 50, 90, 38, () => this.goHome(false))
      this.find.boxes.forEach((box, index) => {
        const x = 25 + index * 112
        const category = FIND_CATEGORIES.find(entry => entry.id === box?.category)
        c.save(); c.translate(2, 4)
        this.round(x - 8, 104, 103, 48, 12, '#3f6b5c')
        c.restore()
        this.round(x - 8, 104, 103, 48, 12, '#fffdf7', '#4d7a5f')
        c.lineWidth = 2; c.strokeStyle = '#4d7a5f'; c.stroke()
        this.text(category?.label || '已封箱', x + 4, 120, 11, '#7d826b', 'left', true)
        if (box) this.text(`${box.count}/${box.total}`, x + 83, 128, 17, '#3f6b5c', 'right', true)
      })
      this.round(25, 166, 325, 58, 16, '#fffdf7', '#8d7352')
      const flight = this.findFlight
      const progress = flight ? Math.min(1, (now - flight.at) / 330) : 1
      for (let index = 0; index < 7; index++) {
        const item = this.find.tray[index]
        const x = 35 + index * 43
        const locked = index >= this.find.trayCapacity
        this.round(x, 178, 38, 34, 7, locked ? '#ddd2c5' : '#f6eddf', '#b4a488')
        if (locked) {
          this.text('＋', x + 19, 195, 18, '#685342', 'center')
          this.buttons.push({ x, y: 178, w: 38, h: 34, action: () => {
            if (this.find.expandTray()) this.notify('托盘已扩到 7 格')
          } })
        }
        if (item && !(progress < 1 && flight.item === item)) {
          this.drawFindItem({ ...item, rot: 0, spot: { x: x + 4, y: 183, w: 23, h: 23 } }, false)
        }
      }
      if (progress < 1) {
        const { from, item, to } = flight
        const mix = (start, end) => start + (end - start) * progress
        this.drawFindItem({ ...item, spot: {
          x: mix(from.x, to.x), y: mix(from.y, to.y),
          w: mix(from.w, 23), h: mix(from.h, 23)
        } }, false)
      }
      this.findButton(`提示 · ${this.findHintLeft}`, 25, 232, 120, 36, () => this.useFindHint(), this.findHintLeft > 0)
      this.findButton('＋', 152, 232, 42, 36, () => this.zoomFind(.25))
      this.findButton('－', 201, 232, 42, 36, () => this.zoomFind(-.25))
      this.text(`双指缩放 · ${Math.round(this.findZoom * 100)}%`, 253, 250, 10, '#7d826b')
      const caption = this.messageUntil > now ? this.message : `已装 ${this.find.filled}/6 箱 · 托盘 ${this.find.tray.length}/${this.find.trayCapacity} · ＋免费扩容`
      this.text(caption, 25, 282, 11, '#657356')
      if (this.find.complete && progress >= 1) this.drawFindResult()
      else if (this.findHelpOpen) this.drawFindHelp()
    }
    get teaserReward() {
      if (!this.care.count('cushion')) return 'cushion'
      if (!this.care.count('ball')) return 'ball'
      if (!this.care.count('sageYarn')) return 'sageYarn'
      if (!this.care.count('mouse')) return 'mouse'
      if (!this.care.count('rustleBag')) return 'rustleBag'
      return this.care.completed(TEASER_REWARD_SOURCE) % 2 ? 'food' : 'water'
    }
    get teaserRewardLabel() {
      const reward = this.teaserReward
      return reward === 'cushion' ? '窗边软垫' : reward === 'sageYarn' ? '鼠尾草绿毛线' : ITEMS[reward].name
    }
    startTeaser() {
      const now = Date.now()
      this.teaser = {
        phase: 'notice', x: 260, y: 295, startX: 260, catX: 112, direction: 1,
        movedAt: now, frameAt: now, dragging: false, distance: 0, gentle: 0,
        chaseMs: 0, rests: 0, misses: 0, wait: 650 + Math.random() * 260
      }
      this.state = 'teaser'
    }
    moveTeaser(x, y, now) {
      const t = this.teaser
      if (t.phase === 'result') return
      const nextX = Math.max(TEASER_AREA.x, Math.min(TEASER_AREA.x + TEASER_AREA.w, x))
      const nextY = Math.max(TEASER_AREA.y, Math.min(TEASER_AREA.y + TEASER_AREA.h, y))
      const delta = Math.hypot(nextX - t.x, nextY - t.y)
      if (delta < 2.5) return
      if (t.phase === 'hold') {
        if (Math.hypot(nextX - t.x, nextY - t.y) >= 12) this.finishTeaser(now)
        return
      }
      const speed = delta * 1000 / Math.max(12, Math.min(70, now - t.movedAt))
      t.distance += delta
      if (speed <= 300 && nextY >= 274) t.gentle += delta
      t.x = nextX
      t.y = nextY
      t.movedAt = now
      if (t.phase === 'notice' && t.distance >= 20) t.phase = 'stalk'
      if (t.phase === 'crouch' && (t.y < 274 || Math.hypot(t.x - t.crouch.x, t.y - t.crouch.y) > TEASER_STILL_RADIUS)) {
        t.phase = 'stalk'
        t.crouch = null
      }
    }
    updateTeaser(now) {
      const t = this.teaser
      const ms = Math.min(50, Math.max(0, now - t.frameAt))
      t.frameAt = now
      if (t.phase === 'notice' || t.phase === 'result') return
      if (t.phase === 'hold') {
        if (now - t.caughtAt >= 1350) this.finishTeaser(now)
        return
      }
      if (t.phase === 'rest') {
        if (now - t.movedAt >= 1100 && t.y >= 274) {
          t.phase = 'stalk'
          t.chaseMs = 0
        }
        return
      }
      if (t.phase === 'pounce') {
        const progress = Math.min(1, (now - t.pounce.at) / 470)
        t.catX = t.pounce.from + (t.pounce.to - t.pounce.from) * progress
        if (progress < 1) return
        if (Math.hypot(t.x - t.pounce.x, t.y - t.pounce.y) > 30) {
          t.misses++
          t.phase = 'rest'
          t.movedAt = now
        } else {
          t.phase = 'hold'
          t.caughtAt = now
          t.x = t.pounce.x
          t.y = t.pounce.y
        }
        return
      }
      if (t.phase === 'crouch') {
        if (now - t.crouch.at < t.wait) return
        t.phase = 'pounce'
        t.pounce = { at: now, x: t.x, y: t.y, from: t.catX, to: Math.max(73, Math.min(294, t.x - t.direction * 29)) }
        return
      }
      const stillFor = now - t.movedAt
      t.chaseMs = stillFor < 180 ? t.chaseMs + ms : Math.max(0, t.chaseMs - ms * 1.4)
      if (t.chaseMs >= 4200) {
        t.rests++
        t.phase = 'rest'
        t.movedAt = now
        return
      }
      const dx = t.x - t.catX
      if (Math.abs(dx) > 7) t.direction = Math.sign(dx)
      if (t.y >= 274) t.catX += t.direction * Math.min(Math.max(0, Math.abs(dx) - 50), .132 * ms)
      if (Math.abs(t.x - t.startX) < 45 || Math.abs(t.x - t.catX) > 57 || t.y < 274 || stillFor < TEASER_SETTLE_MS) return
      t.phase = 'crouch'
      t.crouch = { x: t.x, y: t.y, at: now }
    }
    finishTeaser(now) {
      const t = this.teaser
      if (t.phase !== 'hold') return
      const steering = Math.round(30 * t.gentle / Math.max(1, t.distance))
      const rhythm = Math.max(5, 30 - 5 * t.rests - 8 * t.misses)
      const capture = Math.round(20 * Math.min(1, (now - t.caughtAt) / 1050))
      t.breakdown = [['引起注意', 20, 20], ['轻轻引逗', steering, 30], ['等它扑过来', rhythm, 30], ['让它抓稳', capture, 20]]
      t.score = t.breakdown.reduce((sum, [, points]) => sum + points, 0)
      t.phase = 'result'
      t.dragging = false
      if (t.score >= TEASER_PASS_SCORE) {
        t.prize = this.teaserRewardLabel
        this.care.grant(TEASER_REWARD_SOURCE, this.care.completed(TEASER_REWARD_SOURCE) + 1, this.teaserReward)
      }
    }
    drawFeather(x, y) {
      const c = this.ctx
      c.strokeStyle = '#836b54'; c.lineWidth = 1.25
      c.beginPath(); c.moveTo(318, 194); c.quadraticCurveTo(298, y - 43, x, y); c.stroke()
      c.save(); c.translate(x, y); c.rotate(.55)
      c.fillStyle = '#c36e6e'
      c.beginPath(); c.ellipse(0, 6, 8, 15, -.3, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#e5a880'
      c.beginPath(); c.ellipse(6, 8, 5, 11, .35, 0, Math.PI * 2); c.fill()
      c.strokeStyle = '#fff0d6'; c.lineWidth = 1.2
      c.beginPath(); c.moveTo(0, -3); c.lineTo(-3, 14); c.stroke()
      c.restore()
    }
    drawTeaser() {
      const t = this.teaser
      const now = Date.now()
      this.text('逗猫棒', 26, 70, 32, '#454d38', 'left', true)
      this.button('小游戏', 151, 48, 89, 39, () => { this.cancel(); this.state = 'activities' })
      this.drawRoom(this.roomWeather(now), now)
      if (t.phase === 'result') {
        this.drawCatFromSide(t.catX, 324, 1.1, 'rest', t.direction, now)
        this.text(t.score + ' 分 / 100', W / 2, 410, 27, '#5b513f', 'center', true)
        this.text(t.prize ? '带回猫窝 · ' + t.prize : '达到 ' + TEASER_PASS_SCORE + ' 分可带回礼物', W / 2, 445, 15, '#5b513f', 'center')
        t.breakdown.forEach(([label, points, max], i) => {
          this.text(label, 61, 481 + i * 25, 14, '#655548')
          this.text(points + ' / ' + max, 314, 481 + i * 25, 14, '#655548', 'right')
        })
        this.button(t.prize ? '回猫窝' : '再陪它玩一次', 47, 592, 281, 49,
          () => t.prize ? this.goHome() : this.startTeaser(), true)
        if (!t.prize) this.button('回猫窝', 47, 653, 281, 42, () => this.goHome())
        return
      }
      const jump = t.phase === 'pounce' ? Math.sin(Math.PI * Math.min(1, (now - t.pounce.at) / 470)) * 27 : 0
      const pose = t.phase === 'rest' || t.phase === 'hold' ? 'rest' :
        t.phase === 'pounce' ? 'stretch' : t.phase === 'crouch' ? 'crouch' :
          t.phase === 'stalk' && t.y >= 274 && Math.abs(t.x - t.catX) > 53 ? 'walk' : 'glance'
      this.drawRoomShadow(t.catX, 326, 44, 6, '#76554145')
      this.drawFeather(t.x, t.y)
      this.drawCatFromSide(t.catX, 324 - jump, 1.06, pose, t.direction, now)
      const tips = {
        notice: '让羽毛在地毯上轻轻动一下',
        stalk: '贴着地毯慢慢拖，让它跟上',
        crouch: '它到位了，稳住羽毛',
        pounce: '扑过来了！',
        hold: '抓到了，让它抱一会儿',
        rest: '它想歇一下，把羽毛放低、停一停'
      }
      this.text(tips[t.phase], W / 2, 425, 18, '#5b513f', 'center', true)
      if (t.phase === 'crouch') {
        const progress = Math.min(1, (now - t.crouch.at) / t.wait)
        this.round(122, 457, 131, 5, 3, '#e4d9c8')
        if (progress > 0) this.round(122, 457, 131 * progress, 5, 3, '#91a380')
      }
      if (t.phase === 'hold') {
        const progress = Math.min(1, (now - t.caughtAt) / 1050)
        this.round(103, 457, 169, 6, 3, '#e4d9c8')
        if (progress) this.round(103, 457, 169 * progress, 6, 3, '#91a380')
      }
    }
    openPrivacy() {
      const fallback = () => { this.privacyOpen = true }
      if (typeof this.platform.openPrivacy === 'function') this.platform.openPrivacy(fallback)
      else fallback()
    }
    drawPrivacy() {
      this.buttons = []
      const c = this.ctx
      c.fillStyle = '#2f2a2259'
      c.fillRect(0, 0, W, H)
      this.round(25, 250, 325, 300, 20, '#fffdf8')
      this.text('隐私保护指引', 43, 284, 18, '#454d38', 'left', true)
      const lines = PRIVACY_NOTE.match(/.{1,19}/g) || []
      lines.forEach((line, index) => this.text(line, 43, 318 + index * 21, 11, '#514a41'))
      this.button('我知道了', 43, 496, 289, 40, () => { this.privacyOpen = false }, true)
    }
    loadAgeIcon() {
      if (!this.platform || typeof this.platform.loadImage !== 'function') return
      this.platform.loadImage(AGE_ICON, img => {
        if (!img) return
        this.ageIcon = img
        if (this.scale) this.render()
      })
    }
    drawCompliance() {
      this.text(GAME_NAME, W / 2, 66, 36, '#454d38', 'center', true)
      this.text('轻度收纳 · 养猫', W / 2, 105, 14, '#8d927d', 'center')
      this.cat(W / 2, 156, 1.1)
      this.round(25, 226, 325, 52, 14, '#dfe9d7')
      this.text('《健康游戏忠告》', 41, 252, 15, '#415a37', 'left', true)
      HEALTH_NOTICE.forEach((line, index) => this.text(line, W / 2, 301 + index * 30, 13, '#514a41', 'center'))
      this.round(25, 434, 325, 106, 16, '#fffdf8')
      const iconX = 41, iconY = 450
      let iconW = 58, iconH = 72
      if (this.ageIcon) {
        iconW = Math.round(72 * (this.ageIcon.width / this.ageIcon.height)) || 58
        this.ctx.drawImage(this.ageIcon, iconX, iconY, iconW, iconH)
      } else {
        this.round(iconX, iconY, iconW, iconH, 12, '#3f8f4f')
        this.text(AGE_RATING, iconX + iconW / 2, iconY + 24, 19, '#ffffff', 'center', true)
        this.text('适龄提示', iconX + iconW / 2, iconY + 46, 10, '#ffffff', 'center')
      }
      this.text('点标记查看适龄说明', 112, 467, 12, '#657356', 'left')
      this.text('单机游戏 · 无内购 · 无联网对战', 112, 490, 11, '#9a9589', 'left')
      this.buttons.push({ x: iconX, y: iconY, w: iconW, h: iconH, action: () => { this.ageNoteOpen = true } })
      this.button('开始游戏', 25, 562, 325, 55, () => { this.compliance = false }, true)
      this.button('隐私保护指引', 25, 629, 325, 46, () => this.openPrivacy())
      this.text('适龄提示 8+ · 与平台设置一致', W / 2, 704, 10, '#a09b8d', 'center')
      if (this.ageNoteOpen) {
        this.buttons = []
        this.round(25, 420, 325, 355, 20, '#fffdf8')
        this.text('适龄提示 · ' + AGE_RATING, 43, 448, 17, '#3f8f4f', 'left', true)
        const lines = AGE_NOTE.match(/.{1,17}/g) || []
        lines.forEach((line, index) => this.text(line, 43, 481 + index * 22, 12, '#514a41'))
        this.button('知道了', 43, 724, 289, 38, () => { this.ageNoteOpen = false }, true)
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
        if (this.privacyOpen) this.drawPrivacy()
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
      if (this.state === 'activities' || this.state === 'teaser') {
        if (this.state === 'activities') this.drawActivities()
        else this.drawTeaser()
        return
      }
      if (this.state === 'find') {
        this.drawFind()
        return
      }
      this.text('零食柜', 25, 86, 30, '#454d38', 'left', true)
      if (this.state === 'playing') this.drawBoardStatus()
      this.cat(309, 97, .58)
      this.round(25, 144, 325, 56, 18, '#e9e8da')
      this.text('本局得分', 44, 162, 10, '#8d927d'); this.text(this.game.score, 44, 184, 22, '#536448', 'left', true)
      if (this.mode === 'classic' && this.state === 'playing') {
        const progress = Math.min(1, this.game.lines / this.levelGoal)
        this.text(`第 ${this.unlockedLevel} 关`, 133, 162, 11, '#657356')
        this.text(`${this.game.lines} / ${this.levelGoal} 条`, 133, 183, 16, '#536448', 'left', true)
        const clockColor = this.remainingMs <= 20000 ? '#a65143' : '#536448'
        this.text('剩余时间', 253, 162, 10, clockColor, 'center')
        this.text(this.clockLabel(), 253, 183, 18, clockColor, 'center', true)
        this.round(BX, 204, CELL * 7, 6, 3, '#d6d8c8')
        if (progress > 0) this.round(BX, 204, CELL * 7 * progress, 6, 3, '#789367')
      } else {
        this.text(this.mode === 'daily' ? '今日个人最佳' : '个人最佳', 179, 162, 10, '#8d927d')
        this.text(this.best || 0, 179, 184, 22, '#536448', 'left', true)
      }
      if (this.state === 'playing') {
        this.button('Ⅱ', 292, 150, 45, 43, () => this.pauseBoard())
      }
      this.drawBoard()
      this.text('待收纳的零食', 27, 541, 11, '#9a9589')
      this.drawTray()
      this.button('撤回一步', 218, 687, 132, 46, () => { if (this.state === 'playing') this.undo() })
      const footer = this.mode === 'daily' ? '每日同题 · 本地日期更新' : '填满整行或整列即可清空'
      this.text(footer, W / 2, 758, 11, '#9a9589', 'center')
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
        this.button('继续收纳', 48, 421, 279, 55, () => this.resumeBoard(), true)
        this.button('重新开始这一局', 48, 494, 279, 51, () => this.start(this.mode))
        this.button('回猫窝', 48, 567, 279, 51, () => this.goHome())
      } else if (this.state === 'cleared') {
        if (this.comboPop) this.text(`${this.comboPop.label}  +${this.comboPop.bonus} 分`, W / 2, 98, 16, '#795137', 'center', true)
        this.text(`第 ${this.clearedLevel} 关通关！`, W / 2, 300, 30, '#454d38', 'center', true)
        this.round(74, 340, 227, 90, 20, '#ede4d2')
        this.text('给小猫带回家', W / 2, 361, 12, '#796652', 'center')
        this.text(ITEMS[this.earnedItem].name, W / 2, 395, 29, '#6a573e', 'center', true)
        this.text(`本关得分 ${this.game.score}`, W / 2, 463, 13, '#797164', 'center')
        this.button('回猫窝', 48, 514, 279, 55, () => this.goHome(), true)
        this.button(`进入第 ${this.unlockedLevel} 关`, 48, 581, 279, 51, () => this.start('classic'))
      } else {
        const timedOut = this.overReason === 'time'
        this.text(timedOut ? '时间到啦' : '柜子装满啦', W / 2, 306, 29, '#454d38', 'center', true)
        this.text('这次收纳得分', W / 2, 350, 14, '#96917f', 'center')
        this.text(this.game.score, W / 2, 401, 53, '#657f5a', 'center', true)
        const summary = this.mode === 'classic'
          ? `第 ${this.unlockedLevel} 关 · 清空 ${this.game.lines} / ${this.levelGoal} 条`
          : `清空 ${this.game.lines} 条 · 放好 ${this.game.moves} 块`
        this.text(summary, W / 2, 450, 14, '#96917f', 'center')
        const rescue = this.game.rescueReady
        if (rescue) this.button(timedOut ? '救场 · 多 45 秒' : '救场 · 腾出一个位置', 48, 66, 279, 49, () => this.useRescue(), true)
        this.button(this.mode === 'classic' ? '重试本关' : '再收一柜', 48, 544, 279, 48, () => this.start(this.mode), !rescue)
        if (!timedOut && this.game.last) this.button('撤回最后一步', 48, 601, 279, 46, () => this.undo())
        this.button('回猫窝', 48, 656, 279, 46, () => this.goHome())
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
