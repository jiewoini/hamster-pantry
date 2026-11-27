const Engine = require('./engine')
const { PantryView } = require('./view')

const canvas = wx.createCanvas()

// 昵称本地基础校验：只放行中文/字母/数字，长度 1-8，拦截空值与无意义重复
function localNameCheck(raw) {
  const name = typeof raw === 'string' ? raw.trim() : ''
  if (!name) return { ok: false, code: 'EMPTY', hint: '名字不能为空' }
  if ([...name].length > 8) return { ok: false, code: 'LONG', hint: '最多 8 个字' }
  if (!/^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(name)) return { ok: false, code: 'CHARSET', hint: '只能用中文、字母或数字' }
  if (/(.)\1{4,}/.test(name)) return { ok: false, code: 'REPEAT', hint: '不要重复同一个字' }
  return { ok: true }
}

// 昵称内容安全接口：自有后端，内部再调微信 msgSecCheck
const SEC_CHECK_URL = 'https://api.ooptop.top/api/content/check-name'

const platform = {
  read(key) { try { return wx.getStorageSync(key) || 0 } catch (error) { return 0 } },
  write(key, value) { try { wx.setStorageSync(key, value) } catch (error) {} },
  vibrate() { wx.vibrateShort({ type: 'light', fail() {} }) },
  loadImage(src, done) {
    const img = wx.createImage()
    img.onload = () => done(img)
    img.onerror = () => done(null)
    img.src = src
  },
  openPrivacy(fallback) {
    const local = () => { if (fallback) fallback() }
    if (typeof wx.openPrivacyContract === 'function') {
      wx.openPrivacyContract({ fail: local })
    } else {
      local()
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
  },
  // 先本地规则，再请求自有后端（后端调微信 msgSecCheck）；任何异常都不放行未校验文本
  checkName(content, done) {
    const local = localNameCheck(content)
    if (!local.ok) { done(local); return }
    if (typeof wx.login !== 'function' || typeof wx.request !== 'function') {
      done({ ok: false, code: 'UNAVAILABLE', hint: '名字检查暂不可用，先从推荐里挑一个吧' })
      return
    }
    wx.login({
      success: login => {
        if (!login.code) {
          done({ ok: false, code: 'LOGIN', hint: '微信登录失败，请重试' })
          return
        }
        wx.request({
          url: SEC_CHECK_URL,
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: { content, code: login.code },
          success: res => {
            const body = (res && res.data) || {}
            if (body.pass === true) done({ ok: true })
            else done({ ok: false, code: body.code || 'RISKY', hint: body.hint })
          },
          fail: () => done({ ok: false, code: 'NETWORK', hint: '名字检查失败，先从推荐里挑一个吧' })
        })
      },
      fail: () => done({ ok: false, code: 'LOGIN', hint: '微信登录失败，请重试' })
    })
  }
}
const view = new PantryView(canvas, Engine, platform)
function resize() {
  const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
  view.resize(info.windowWidth, info.windowHeight, Math.min(info.pixelRatio || 2, 3))
}
resize()
wx.onTouchStart(e => { if (e.touches[0]) view.down(e.touches[0].clientX, e.touches[0].clientY, e.touches) })
wx.onTouchMove(e => { if (e.touches[0]) view.move(e.touches[0].clientX, e.touches[0].clientY, e.touches) })
wx.onTouchEnd(e => { if (e.changedTouches[0]) view.up(e.changedTouches[0].clientX, e.changedTouches[0].clientY, e.touches) })
wx.onTouchCancel(e => { view.up(0, 0, []) ; view.cancel() })
wx.onWindowResize(resize)
wx.onShow(() => { view.resume(); resize() })
wx.onHide(() => view.suspend())
wx.showShareMenu({ menus: ['shareAppMessage'] })
wx.onShareAppMessage(() => ({ title: '来猫爪收纳局，给小猫赚点零食吧！' }))
