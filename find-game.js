(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.FindGame = factory()
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CATEGORIES = [
    { id: 'snack', label: '小零食', color: '#f3c98a' },
    { id: 'hat', label: '帽子', color: '#cfd9ea' },
    { id: 'vehicle', label: '交通玩具', color: '#d8c6e6' }
  ]
  const TARGET_PER_CATEGORY = 5
  const ROOMS = [
    { name: '窗边软床', light: '#d4dfab', mid: '#a9bf91', dark: '#8ca981' },
    { name: '午后书角', light: '#dce8ef', mid: '#b0c8d8', dark: '#829eb7' },
    { name: '暖灯小阁楼', light: '#f1dfcf', mid: '#e1bbab', dark: '#c19187' }
  ]
  const LEVELS = ROOMS.flatMap((room, roomIndex) => [
    { first: [2, 2, 2], covers: 1, slots: 5 },
    { first: [3, 2, 1], covers: 1, slots: 4 },
    { first: [1, 3, 2], covers: 2, slots: 4 },
    { first: [2, 1, 3], covers: 3, slots: 3 }
  ].map((rule, index) => ({ ...rule, room, mirror: (roomIndex + index) % 2 === 1 })))
  const POOL = {
    snack: [
      { id: 'chips', label: '薯片' },
      { id: 'lollipop', label: '棒棒糖' },
      { id: 'biscuit', label: '饼干' },
      { id: 'icecream', label: '冰淇淋' },
      { id: 'candy', label: '糖果' }
    ],
    hat: [
      { id: 'cap', label: '棒球帽' },
      { id: 'strawHat', label: '草帽' },
      { id: 'beanie', label: '毛线帽' },
      { id: 'beret', label: '贝雷帽' },
      { id: 'helmet', label: '小头盔' }
    ],
    vehicle: [
      { id: 'car', label: '小汽车' },
      { id: 'bus', label: '巴士' },
      { id: 'train', label: '小火车' },
      { id: 'plane', label: '小飞机' },
      { id: 'bike', label: '自行车' }
    ]
  }
  const SPOTS = [
    { x: 52, y: 317, w: 41, h: 41 },
    { x: 229, y: 327, w: 48, h: 48 },
    { x: 113, y: 377, w: 54, h: 54 },
    { x: 280, y: 417, w: 53, h: 53 },
    { x: 174, y: 450, w: 43, h: 43 },
    { x: 42, y: 476, w: 46, h: 46 },
    { x: 120, y: 546, w: 48, h: 48 },
    { x: 251, y: 566, w: 44, h: 44 },
    { x: 177, y: 637, w: 52, h: 52 },
    { x: 166, y: 332, w: 42, h: 42 },
    { x: 219, y: 391, w: 43, h: 43 },
    { x: 105, y: 473, w: 43, h: 43 },
    { x: 252, y: 495, w: 48, h: 48 },
    { x: 53, y: 587, w: 46, h: 46 },
    { x: 284, y: 635, w: 43, h: 43 }
  ]

  function random(seed) {
    let value = (Number(seed) || 1) >>> 0
    return function () {
      value = (value * 1664525 + 1013904223) >>> 0
      return value / 4294967296
    }
  }

  function shuffle(list, next) {
    const result = list.slice()
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1))
      const temp = result[i]
      result[i] = result[j]
      result[j] = temp
    }
    return result
  }

  class FindGame {
    constructor(seed, round = 1) {
      const next = random(seed)
      const spots = shuffle(SPOTS, next)
      this.round = Math.max(1, Number(round) || 1)
      this.rules = LEVELS[(this.round - 1) % LEVELS.length]
      this.items = []
      this.tray = []
      this.trayCapacity = this.rules.slots
      this.filled = 0
      this.boxes = CATEGORIES.map((category, index) => ({ category: category.id, count: 0, total: this.rules.first[index] }))
      this.orders = shuffle(this.boxes, next).map(box => ({ category: box.category, count: 0, total: TARGET_PER_CATEGORY - box.total }))
      CATEGORIES.forEach((category, categoryIndex) => {
        const picks = shuffle(POOL[category.id], next).slice(0, TARGET_PER_CATEGORY)
        picks.forEach((entry, itemIndex) => {
          const spot = spots[categoryIndex * TARGET_PER_CATEGORY + itemIndex]
          this.items.push({
            ...entry,
            category: category.id,
            categoryLabel: category.label,
            spot: this.rules.mirror ? { ...spot, x: 375 - spot.x - spot.w } : spot,
            rot: (next() - .5) * .7,
            covered: itemIndex < this.rules.covers,
            coverSide: ['bottom', 'right', 'left'][categoryIndex],
            found: false
          })
        })
      })
    }

    get complete() {
      return this.items.every(item => item.found)
    }

    progress(category) {
      const items = this.items.filter(item => item.category === category)
      return { found: items.filter(item => item.found).length, total: items.length }
    }

    unfound() {
      return this.items.filter(item => !item.found)
    }

    expandTray() {
      if (this.trayCapacity > 5) return false
      this.trayCapacity = 7
      return true
    }

    fillBoxes() {
      for (const [index, box] of this.boxes.entries()) {
        if (!box) continue
        const itemIndex = this.tray.findIndex(item => item.category === box.category)
        if (itemIndex < 0) continue
        this.tray.splice(itemIndex, 1)
        box.count++
        if (box.count === box.total) {
          this.filled++
          this.boxes[index] = this.orders.shift() || null
        }
        this.fillBoxes()
        return
      }
    }

    collect(id) {
      const item = this.items.find(entry => entry.id === id)
      if (!item || item.found) return { ok: false }
      const matching = this.boxes.some(box => box?.category === item.category)
      if (!matching && this.tray.length >= this.trayCapacity) return { ok: false, full: true }
      const before = this.filled
      item.found = true
      this.tray.push(item)
      this.fillBoxes()
      return { ok: true, id: item.id, label: item.label, category: item.category, complete: this.complete, filled: this.filled - before, staged: this.tray.includes(item) }
    }
  }

  return { FindGame, CATEGORIES, TARGET_PER_CATEGORY, LEVELS }
})
