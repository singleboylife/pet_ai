const express = require('express')
const router  = express.Router()
const pool    = require('../database/db')
const auth    = require('../middleware/auth')
const { localDate } = require('../utils/time')

// 积分余额
router.get('/balance', auth, async (req, res) => {
  try {
    const [[user]] = await pool.query('SELECT points FROM users WHERE id = ?', [req.user.id])
    res.json({ code: 200, data: { points: user.points } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 积分流水
router.get('/transactions', auth, async (req, res) => {
  const { page = 1, limit = 20, type } = req.query
  const offset = (page - 1) * limit
  let query = 'SELECT * FROM points_transactions WHERE user_id = ?'
  const params = [req.user.id]
  if (type) { query += ' AND type = ?'; params.push(type) }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  try {
    const [list] = await pool.query(query, params)
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM points_transactions WHERE user_id = ?', [req.user.id])
    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 每日签到
router.post('/checkin', auth, async (req, res) => {
  const today = localDate()
  try {
    const [[exists]] = await pool.query('SELECT id FROM checkins WHERE user_id = ? AND checkin_date = ?', [req.user.id, today])
    if (exists) return res.json({ code: 400, message: '今天已经签到过了' })

    const [[user]] = await pool.query('SELECT points, is_member, member_expire FROM users WHERE id = ?', [req.user.id])
    let multiplier = 1
    if (user.is_member && user.member_expire && new Date(user.member_expire) > new Date()) multiplier = 2

    const yesterday = localDate(new Date(Date.now() - 86400000))
    const [[{ cnt: streak }]] = await pool.query(
      'SELECT COUNT(*) as cnt FROM checkins WHERE user_id = ? AND checkin_date >= ?',
      [req.user.id, yesterday]
    )
    let bonusPoints = 0
    if (streak >= 7) bonusPoints = 20
    else if (streak >= 3) bonusPoints = 10

    const totalEarn = 10 * multiplier + bonusPoints
    const newPoints = user.points + totalEarn

    await pool.query('INSERT INTO checkins (user_id, checkin_date, points_earned) VALUES (?, ?, ?)', [req.user.id, today, totalEarn])
    await pool.query('UPDATE users SET points = ? WHERE id = ?', [newPoints, req.user.id])
    await pool.query(
      "INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, ?, 'earn', ?, ?)",
      [req.user.id, totalEarn, `每日签到（${multiplier > 1 ? '会员' + multiplier + '倍' : ''}${bonusPoints > 0 ? '+连签奖励' + bonusPoints : ''}）`, newPoints]
    )
    res.json({
      code: 200,
      message: `签到成功，获得${totalEarn}积分${bonusPoints > 0 ? '（含连签奖励' + bonusPoints + '分）' : ''}`,
      data: { points: newPoints, earned: totalEarn, bonus: bonusPoints }
    })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 签到状态
router.get('/checkin/status', auth, async (req, res) => {
  const today = localDate()
  try {
    const [[todayRecord]] = await pool.query('SELECT id FROM checkins WHERE user_id = ? AND checkin_date = ?', [req.user.id, today])
    const monthStart = today.slice(0, 7) + '-01'
    const [monthRecords] = await pool.query('SELECT checkin_date FROM checkins WHERE user_id = ? AND checkin_date >= ?', [req.user.id, monthStart])
    res.json({ code: 200, data: { checked_today: !!todayRecord, month_days: monthRecords.map(r => r.checkin_date) } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 积分兑换
router.post('/exchange', auth, async (req, res) => {
  const { type, amount } = req.body
  try {
    const [[user]] = await pool.query('SELECT points, wallet_balance FROM users WHERE id = ?', [req.user.id])
    if (type === 'wallet') {
      const pts = parseInt(amount) || 0
      if (pts < 100) return res.json({ code: 400, message: '最少兑换100积分' })
      if (user.points < pts) return res.json({ code: 400, message: '积分不足' })
      const yuan = parseFloat((pts / 100).toFixed(2))
      const newPoints  = user.points - pts
      const newBalance = parseFloat((user.wallet_balance + yuan).toFixed(2))
      await pool.query('UPDATE users SET points = ?, wallet_balance = ? WHERE id = ?', [newPoints, newBalance, req.user.id])
      await pool.query("INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, ?, 'spend', '积分兑换余额', ?)",
        [req.user.id, -pts, newPoints])
      await pool.query("INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after) VALUES (?, ?, 'recharge', '积分兑换', ?)",
        [req.user.id, yuan, newBalance])
      return res.json({ code: 200, message: `成功兑换${yuan}元余额`, data: { points: newPoints, balance: newBalance } })
    }
    res.json({ code: 400, message: '不支持的兑换类型' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

module.exports = router
