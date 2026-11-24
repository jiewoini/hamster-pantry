(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.CatCare = factory()
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SAVE_KEY = 'pantry_cat_care_v1'
  const COATS = {
    golden: { label: '金渐层', fur: '#e5b16a', edge: '#896744', cream: '#fff1d4', mark: '#a37a51', card: '#f8ecd5', pattern: 'shaded', eyes: '#90ad64', round: true },
    orange: { label: '橘猫', fur: '#efad68', edge: '#a96842', cream: '#fff1d9', mark: '#ce854b', card: '#f8e6ce' },
    tuxedo: { label: '奶牛猫', fur: '#fcf4e6', edge: '#5c5151', cream: '#fffaf1', mark: '#514a53', card: '#eae5ed' },
    calico: { label: '三花猫', fur: '#fff2dc', edge: '#967059', cream: '#fff8ec', mark: '#e1a16a', card: '#f7e1da' },
    tabby: { label: '狸花猫', fur: '#b5a08a', edge: '#685749', cream: '#e9d9c4', mark: '#786252', card: '#e7ebdc', pattern: 'striped' },
    silver: { label: '银渐层', fur: '#e1dfda', edge: '#797c83', cream: '#fcf8ee', mark: '#9397a0', card: '#e8e8ef', pattern: 'shaded', eyes: '#658d7e', round: true },
    british: { label: '英短蓝猫', fur: '#8d99aa', edge: '#626c80', cream: '#aeb6c4', mark: '#6d798c', card: '#e0e7ef', eyes: '#b77e39', round: true },
    american: { label: '美短虎斑', fur: '#babac0', edge: '#655f6e', cream: '#e4e1e1', mark: '#766e7f', card: '#e7e4ed', pattern: 'striped' },
    ragdoll: { label: '布偶猫', fur: '#f2e8dc', edge: '#827485', cream: '#fff6e9', mark: '#948298', card: '#eae4f0', pattern: 'point', eyes: '#658bb1', fluffy: true },
    siamese: { label: '暹罗猫', fur: '#ecd4b1', edge: '#76564b', cream: '#f3dcc0', mark: '#79574e', card: '#f3e5db', pattern: 'point', eyes: '#5f8bb4' },
    maine: { label: '缅因猫', fur: '#b98e6e', edge: '#765747', cream: '#efcfaa', mark: '#927057', card: '#f0e2d8', pattern: 'striped', fluffy: true },
    persian: { label: '波斯猫', fur: '#f1e9e2', edge: '#8d7d84', cream: '#fff8f0', mark: '#b6a3aa', card: '#f1e4eb', eyes: '#a87943', fluffy: true, round: true },
    bengal: { label: '孟加拉猫', fur: '#d8a26a', edge: '#785744', cream: '#f4d5a8', mark: '#805841', card: '#f5e6d4', pattern: 'spotted' },
    russian: { label: '俄罗斯蓝猫', fur: '#8999a1', edge: '#586974', cream: '#a9b7bc', mark: '#647784', card: '#e1ebea', eyes: '#668b5d' },
    black: { label: '黑猫', fur: '#655d69', edge: '#433b49', cream: '#766b78', mark: '#4c4453', card: '#e7e2ed', eyes: '#bc9447' },
    white: { label: '白猫', fur: '#f6efe6', edge: '#968b87', cream: '#fffbf2', mark: '#d6c8c1', card: '#eee8df', eyes: '#6c95ae' },
    abyssinian: { label: '阿比西尼亚猫', fur: '#c88859', edge: '#875740', cream: '#eebf91', mark: '#945c41', card: '#f2e2d4', pattern: 'shaded', eyes: '#83915c' },
    norwegian: { label: '挪威森林猫', fur: '#8a817f', edge: '#645452', cream: '#f0e0d4', mark: '#60565b', card: '#eae5e0', pattern: 'striped', fluffy: true, eyes: '#a18756' },
    birman: { label: '伯曼猫', fur: '#eddbc1', edge: '#856858', cream: '#fff6e3', mark: '#806657', card: '#f0e7da', pattern: 'point', fluffy: true, eyes: '#6f91bb' },
    sphynx: { label: '斯芬克斯猫', fur: '#d5a99f', edge: '#a77973', cream: '#e4beb1', mark: '#af847b', card: '#f4e3e0', pattern: 'wrinkled', eyes: '#719276', tallEars: true },
    rex: { label: '德文卷毛猫', fur: '#e4c4a0', edge: '#9f806b', cream: '#f7e4c9', mark: '#baa08c', card: '#eee6db', pattern: 'spotted', tallEars: true },
    scottish: { label: '苏格兰折耳猫', fur: '#a8acb9', edge: '#696d7d', cream: '#ced0d9', mark: '#818798', card: '#e7e8ef', round: true, folded: true, eyes: '#b18a53' },
    tortie: { label: '玳瑁猫', fur: '#70606a', edge: '#594a52', cream: '#9f7965', mark: '#cd9467', card: '#efe4df', pattern: 'patch', eyes: '#b79454' },
    snowshoe: { label: '雪鞋猫', fur: '#e3ceba', edge: '#75615f', cream: '#fff7eb', mark: '#8c7370', card: '#eee3e3', pattern: 'point', eyes: '#6b90b7' }
  }
  const ITEMS = {
    food: { name: '猫粮', action: '喂猫粮', message: '团子低头吃起了猫粮。', stat: 'mood', gain: 15 },
    water: { name: '清水', action: '倒清水', message: '团子凑过来喝了几口水。', stat: 'mood', gain: 10 },
    box: { name: '纸箱', action: '陪它玩', message: '团子钻进纸箱，只露出两只耳朵。', stat: 'energy', gain: 20, reusable: true },
    scarf: { name: '小领巾', action: '戴领巾', message: '团子戴着小领巾，抬起了下巴。', stat: 'mood', gain: 8, reusable: true },
    ball: { name: '毛线球', action: '滚毛线球', message: '团子追上毛线球，伸爪一按。', stat: 'energy', gain: 10, reusable: true }
  }
  const hasItem = item => Object.prototype.hasOwnProperty.call(ITEMS, item)
  const BALL_COLORS = {
    rose: { label: '蜜桃粉', edge: '#b65e62', yarn: '#d88684', thread: '#f2ada0' },
    sage: { label: '鼠尾草绿', edge: '#67896e', yarn: '#89ac83', thread: '#c2d4a6' }
  }
  const REWARDS = new Set([...Object.keys(ITEMS), 'cushion', 'sageYarn'])
  const FAVORITES = {
    pet: { label: '摸摸头', message: '把头又往你的手心里拱了拱。' },
    food: { label: '吃香香的猫粮', message: '吃完还绕着碗边舔了一圈。' },
    box: { label: '钻纸箱', message: '抱着纸箱边不撒爪，翻了个身。' }
  }
  const FAVORITE_IDS = Object.keys(FAVORITES)

  class CatCare {
    constructor(platform) {
      this.platform = platform
      this.state = { mood: 45, energy: 35, inventory: { food: 1, water: 1 }, progress: {}, scarf: false }
      try {
        const saved = JSON.parse(platform.read(SAVE_KEY))
        if (saved && typeof saved === 'object') Object.assign(this.state, saved)
      } catch (error) {}
      if (this.state.profile && !this.state.favorite) {
        this.save({ ...this.state, favorite: this.pickFavorite() })
      }
    }
    setProfile(coat, name) {
      const clean = typeof name === 'string' ? name.trim() : ''
      if (!Object.prototype.hasOwnProperty.call(COATS, coat) || !clean || [...clean].length > 8 || /[\x00-\x1f\x7f]/.test(clean)) return false
      const favorite = this.state.favorite || this.pickFavorite()
      this.save({ ...this.state, favorite, profile: { coat, name: clean } })
      return true
    }
    pickFavorite() {
      return FAVORITE_IDS[Math.floor(Math.random() * FAVORITE_IDS.length)]
    }
    reactTo(activity) {
      if (activity !== this.state.favorite || !FAVORITES[activity]) return ''
      if (!this.state.favoriteKnown) this.save({ ...this.state, favoriteKnown: true })
      return FAVORITES[activity].message
    }
    finishBoxIntroduction() {
      if (this.count('box') && !this.state.metBox) this.save({ ...this.state, metBox: true })
    }
    saveBoxPhoto(now, weather) {
      if (!this.state.profile || !this.state.metBox || this.state.boxPhoto) return false
      const boxPhoto = { ...this.state.profile, time: now, weather }
      this.save({ ...this.state, boxPhoto })
      return true
    }
    placeCushion() {
      if (!this.count('cushion') || this.state.cushionPlaced) return false
      this.save({ ...this.state, cushionPlaced: true })
      return true
    }
    smoothRug() {
      if (!this.state.rugRumpled) return false
      this.save({ ...this.state, rugRumpled: false })
      return true
    }
    cleanCrumbs() {
      if (!this.state.foodCrumbs) return false
      this.save({ ...this.state, foodCrumbs: false })
      return true
    }
    chooseBallColor(color) {
      if (!this.count('ball') || (color !== 'rose' && !(color === 'sage' && this.count('sageYarn')))) return false
      this.save({ ...this.state, ballColor: color })
      return true
    }
    saveCushionPhoto(now, weather) {
      if (!this.state.profile || !this.state.cushionPlaced || this.state.cushionPhoto) return false
      const cushionPhoto = { ...this.state.profile, time: now, weather }
      this.save({ ...this.state, cushionPhoto })
      return true
    }
    save(next) {
      this.platform.write(SAVE_KEY, JSON.stringify(next))
      this.state = next
    }
    completed(source) { return this.state.progress[source] || 0 }
    count(item) { return this.state.inventory[item] || 0 }
    grant(source, milestone, item) {
      if (milestone <= this.completed(source) || !REWARDS.has(item)) return false
      const inventory = { ...this.state.inventory, [item]: !ITEMS[item] || ITEMS[item].reusable ? 1 : this.count(item) + 1 }
      const progress = { ...this.state.progress, [source]: milestone }
      this.save({ ...this.state, inventory, progress })
      return true
    }
    use(item) {
      if (!hasItem(item) || !this.count(item)) return ''
      const entry = ITEMS[item]
      if (item === 'scarf' && this.state.scarf) {
        this.save({ ...this.state, scarf: false })
        return '团子摘下了小领巾。'
      }
      const inventory = { ...this.state.inventory }
      if (!entry.reusable) inventory[item]--
      const gain = item === 'scarf' && this.state.woreScarf ? 0 : entry.gain
      const next = { ...this.state, inventory, [entry.stat]: Math.min(100, this.state[entry.stat] + gain) }
      if (item === 'scarf') {
        next.scarf = true
        next.woreScarf = true
      }
      if (item === 'ball') next.rugRumpled = true
      if (item === 'food') next.foodCrumbs = true
      this.save(next)
      return entry.message
    }
  }

  return { CatCare, ITEMS, COATS, FAVORITES, BALL_COLORS }
})
