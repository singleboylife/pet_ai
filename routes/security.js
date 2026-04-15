const express = require('express')
const router = express.Router()
const pool = require('../database/db')
const auth = require('../middleware/auth')
const { createVerificationCode, verifyCode, isPhoneRegistered } = require('../utils/sms')

// ============ 验证码相关 ============

// 发送验证码
router.post('/send-code', async (req, res) => {
  const { phone, type = 'bind' } = req.body

  // 验证手机号格式
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.json({ code: 400, message: '请输入正确的手机号' })
  }

  // 如果是注册类型，检查手机号是否已注册
  if (type === 'register') {
    const registered = await isPhoneRegistered(phone)
    if (registered) {
      return res.json({ code: 400, message: '该手机号已注册' })
    }
  }

  // 如果是绑定类型，检查手机号是否已被其他用户绑定
  if (type === 'bind' && req.user) {
    const [[existing]] = await pool.query('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, req.user.id])
    if (existing) {
      return res.json({ code: 400, message: '该手机号已被其他用户绑定' })
    }
  }

  try {
    const result = await createVerificationCode(phone, type)
    res.json({
      code: 200,
      message: '验证码已发送',
      data: { code: result.code } // 开发环境返回验证码，生产环境不返回
    })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ============ 手机号绑定 ============

// 绑定手机号
router.post('/bind-phone', auth, async (req, res) => {
  const { phone, code } = req.body

  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return res.json({ code: 400, message: '请输入正确的手机号' })
  }

  if (!code) {
    return res.json({ code: 400, message: '请输入验证码' })
  }

  // 检查手机号是否已被其他用户绑定
  const [[existing]] = await pool.query('SELECT id FROM users WHERE phone = ? AND id != ?', [phone, req.user.id])
  if (existing) {
    return res.json({ code: 400, message: '该手机号已被其他用户绑定' })
  }

  // 验证验证码
  const verifyResult = await verifyCode(phone, code, 'bind')
  if (!verifyResult.success) {
    return res.json({ code: 400, message: verifyResult.message })
  }

  try {
    await pool.query(
      'UPDATE users SET phone = ?, phone_verified = 1 WHERE id = ?',
      [phone, req.user.id]
    )
    res.json({ code: 200, message: '手机号绑定成功' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 解绑手机号
router.post('/unbind-phone', auth, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET phone = NULL, phone_verified = 0 WHERE id = ?',
      [req.user.id]
    )
    res.json({ code: 200, message: '手机号已解绑' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ============ 身份证实名认证 ============

// 提交实名认证
router.post('/verify-identity', auth, async (req, res) => {
  const { real_name, id_card } = req.body

  if (!real_name || !id_card) {
    return res.json({ code: 400, message: '请填写真实姓名和身份证号' })
  }

  // 验证身份证号格式（简单验证）
  if (!/^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/.test(id_card)) {
    return res.json({ code: 400, message: '身份证号格式不正确' })
  }

  // 检查身份证号是否已被其他用户使用
  const [[existing]] = await pool.query('SELECT id FROM users WHERE id_card = ? AND id != ?', [id_card, req.user.id])
  if (existing) {
    return res.json({ code: 400, message: '该身份证号已被使用' })
  }

  try {
    // TODO: 接入真实的身份证验证API（如阿里云实人认证）
    // const verifyResult = await aliyunIdentity.verify(real_name, id_card)
    // if (!verifyResult.success) {
    //   return res.json({ code: 400, message: '实名认证失败，请检查信息是否正确' })
    // }

    await pool.query(
      'UPDATE users SET real_name = ?, id_card = ?, id_verified = 1, id_verified_at = NOW() WHERE id = ?',
      [real_name, id_card, req.user.id]
    )

    res.json({ code: 200, message: '实名认证成功' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 获取安全信息
router.get('/security-info', auth, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      'SELECT phone, phone_verified, real_name, id_card, id_verified, id_verified_at FROM users WHERE id = ?',
      [req.user.id]
    )

    // 脱敏处理
    if (user.phone) {
      user.phone_masked = user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
    }
    if (user.id_card) {
      user.id_card_masked = user.id_card.replace(/^(.{6})(?:\d+)(.{4})$/, '$1**********$2')
    }

    // 不返回完整的敏感信息
    delete user.id_card

    res.json({ code: 200, data: user })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

module.exports = router
