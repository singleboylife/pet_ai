const express = require('express')
const router  = express.Router()
const pool    = require('../database/db')
const auth    = require('../middleware/auth')
const { localDate, localDateTime } = require('../utils/time')

// 会员套餐列表
router.get('/plans', auth, async (req, res) => {
  try {
    const [plans] = await pool.query('SELECT * FROM member_plans WHERE is_active = 1 ORDER BY sort_order ASC')
    plans.forEach(p => { p.features = p.features || [] })
    res.json({ code: 200, data: plans })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 当前会员状态
router.get('/status', auth, async (req, res) => {
  try {
    const [[user]] = await pool.query('SELECT is_member, member_expire, points, wallet_balance FROM users WHERE id = ?', [req.user.id])
    let active = false
    if (user.is_member && user.member_expire) {
      active = new Date(user.member_expire) > new Date()
      if (!active) await pool.query('UPDATE users SET is_member = 0 WHERE id = ?', [req.user.id])
    }
    const [[lastSub]] = await pool.query('SELECT * FROM member_subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1', [req.user.id])
    res.json({ code: 200, data: { is_member: active ? 1 : 0, member_expire: user.member_expire, last_subscription: lastSub || null } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 订购会员
router.post('/subscribe', auth, async (req, res) => {
  const { plan_id, payment_method = 'wallet' } = req.body
  if (!plan_id) return res.json({ code: 400, message: '请选择会员套餐' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [[plan]] = await conn.query('SELECT * FROM member_plans WHERE id = ? AND is_active = 1', [plan_id])
    if (!plan) { await conn.rollback(); conn.release(); return res.json({ code: 404, message: '套餐不存在' }) }

    const [[user]] = await conn.query('SELECT * FROM users WHERE id = ?', [req.user.id])

    if (payment_method !== 'wallet') { await conn.rollback(); conn.release(); return res.json({ code: 400, message: '暂不支持该支付方式' }) }
    if (user.wallet_balance < plan.price) { await conn.rollback(); conn.release(); return res.json({ code: 400, message: `钱包余额不足（需要${plan.price}元），请先充值` }) }

    const newBalance = parseFloat((user.wallet_balance - plan.price).toFixed(2))
    await conn.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, req.user.id])
    await conn.query("INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after) VALUES (?, ?, 'spend', ?, ?)",
      [req.user.id, -plan.price, `订购${plan.name}`, newBalance])

    const now = new Date()
    let startDate = now
    if (user.is_member && user.member_expire && new Date(user.member_expire) > now) {
      startDate = new Date(user.member_expire)
    }
    const endDate = new Date(startDate.getTime() + plan.duration * 24 * 60 * 60 * 1000)

    await conn.query('UPDATE users SET is_member = 1, member_expire = ? WHERE id = ?', [localDateTime(endDate), req.user.id])
    await conn.query('INSERT INTO member_subscriptions (user_id, plan_id, start_date, end_date, payment_amount) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, plan_id, localDateTime(startDate), localDateTime(endDate), plan.price])

    await conn.commit(); conn.release()
    res.json({
      code: 200,
      message: `${plan.name}订购成功，有效期至 ${localDate(endDate)}`,
      data: { member_expire: localDateTime(endDate), balance: newBalance }
    })
  } catch (err) {
    await conn.rollback(); conn.release()
    res.json({ code: 500, message: err.message })
  }
})

// 订购历史
router.get('/history', auth, async (req, res) => {
  try {
    const [list] = await pool.query(`
      SELECT s.*, p.name as plan_name, p.duration
      FROM member_subscriptions s JOIN member_plans p ON s.plan_id = p.id
      WHERE s.user_id = ? ORDER BY s.created_at DESC
    `, [req.user.id])
    res.json({ code: 200, data: list })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

module.exports = router
