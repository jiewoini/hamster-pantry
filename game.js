const Engine = require('./engine')
const { PantryView } = require('./view')

const canvas = wx.createCanvas()
const platform = {
  read(key) { try { return wx.getStorageSync(key) || 0 } catch (error) { return 0 } },
  write(key, value) { try { wx.setStorageSync(key, value) } catch (error) {} },
  vibrate() { wx.vibrateShort({ type: 'light', fail() {} }) },
  openPrivacy() {
    if (typeof wx.openPrivacyContract === 'function') {
      wx.openPrivacyContract({ fail() { wx.showToast({ title: '请先在后台配置隐私保护指引', icon: 'none' }) } })
    } else {
      wx.showModal({ title: '隐私保护指引', content: '本游戏仅在本机保存进度，不收集个人信息。', showCancel: false })
    }
  },
  requestName(current, done) {
    let finished = false
    const confirm = event => finish(event.value)
    const complete = () => finish()
    function finish(value) {
      if (finished) return
      finished = true
      wx.offKeyboardConfirm(confirm)
      wx.offKeyboardComplete(complete)
      done(value)
    }
    wx.onKeyboardConfirm(confirm)
    wx.onKeyboardComplete(complete)
    wx.showKeyboard({ defaultValue: current, maxLength: 8, multiple: false, confirmHold: false, confirmType: 'done', fail: complete })
  }
}
const view = new PantryView(canvas, Engine, platform)
function resize() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  view.resize(info.windowWidth, info.windowHeight, Math.min(info.pixelRatio || 2, 3))
}
resize()
wx.onTouchStart(e => { if (e.touches[0]) view.down(e.touches[0].clientX, e.touches[0].clientY) })
wx.onTouchMove(e => { if (e.touches[0]) view.move(e.touches[0].clientX, e.touches[0].clientY) })
wx.onTouchEnd(e => { if (e.changedTouches[0]) view.up(e.changedTouches[0].clientX, e.changedTouches[0].clientY) })
wx.onTouchCancel(() => view.cancel())
wx.onWindowResize(resize)
wx.onShow(() => { view.resume(); resize() })
wx.onHide(() => view.suspend())
wx.showShareMenu({ menus: ['shareAppMessage'] })
wx.onShareAppMessage(() => ({ title: '来猫爪收纳局，给小猫赚点零食吧！' }))
