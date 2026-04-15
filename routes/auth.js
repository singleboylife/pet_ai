const express = require('express')
const router  = express.Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const pool    = require('../database/db')

// 注册
router.post('/register', async (req, res) => {
  const { username, password, nickname, phone, code } = req.body
  if (!username || !password) return res.json({ code: 400, message: '用户名和密码不能为空' })
  if (username.length < 3 || username.length > 20) return res.json({ code: 400, message: '用户名长度为3-20位' })
  if (password.length < 6) return res.json({ code: 400, message: '密码不能少于6位' })

  // 如果提供了手机号，必须验证
  if (phone) {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.json({ code: 400, message: '请输入正确的手机号' })
    }
    if (!code) {
      return res.json({ code: 400, message: '请输入验证码' })
    }

    // 验证验证码
    const { verifyCode } = require('../utils/sms')
    const verifyResult = await verifyCode(phone, code, 'register')
    if (!verifyResult.success) {
      return res.json({ code: 400, message: verifyResult.message })
    }
  }

  try {
    const [[exists]] = await pool.query('SELECT id FROM users WHERE username = ?', [username])
    if (exists) return res.json({ code: 400, message: '用户名已被使用' })

    // 检查手机号是否已注册
    if (phone) {
      const [[phoneExists]] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone])
      if (phoneExists) return res.json({ code: 400, message: '该手机号已注册' })
    }

    const hash = await bcrypt.hash(password, 10)
    const nick = nickname || username
    const [result] = await pool.query(
      'INSERT INTO users (username, password, nickname, phone, phone_verified) VALUES (?, ?, ?, ?, ?)',
      [username, hash, nick, phone || null, phone ? 1 : 0]
    )
    const userId = result.insertId

    await pool.query(
      "INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, 50, 'earn', '新用户注册赠送', 50)",
      [userId]
    )
    await pool.query('UPDATE users SET points = 50 WHERE id = ?', [userId])

    const token = jwt.sign({ id: userId, username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })
    res.json({
      code: 200,
      message: '注册成功，赠送50积分',
      data: { token, user: { id: userId, username, nickname: nick, avatar: '', points: 50, wallet_balance: 0, is_member: 0 } }
    })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) return res.json({ code: 400, message: '用户名和密码不能为空' })

  try {
    const [[user]] = await pool.query('SELECT * FROM users WHERE username = ?', [username])
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.json({ code: 400, message: '用户名或密码错误' })
    }
    if (user.is_member && user.member_expire && new Date(user.member_expire) < new Date()) {
      await pool.query('UPDATE users SET is_member = 0 WHERE id = ?', [user.id])
      user.is_member = 0
    }
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })
    res.json({
      code: 200, message: '登录成功',
      data: {
        token,
        user: {
          id: user.id, username: user.username, nickname: user.nickname,
          avatar: user.avatar, bio: user.bio, points: user.points,
          wallet_balance: user.wallet_balance, is_member: user.is_member,
          member_expire: user.member_expire
        }
      }
    })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 刷新 Token
router.post('/refresh', (req, res) => {
  const authHeader = req.headers['authorization']
  if (!authHeader) return res.json({ code: 401, message: '未授权' })
  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true })
    const newToken = jwt.sign({ id: decoded.id, username: decoded.username }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN })
    res.json({ code: 200, data: { token: newToken } })
  } catch {
    res.json({ code: 401, message: 'Token 无效' })
  }
})

module.exports = router
