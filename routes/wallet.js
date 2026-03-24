const express = require('express')
const router  = express.Router()
const pool    = require('../database/db')
const auth    = require('../middleware/auth')

// 钱包余额
router.get('/balance', auth, async (req, res) => {
  try {
    const [[user]] = await pool.query('SELECT wallet_balance FROM users WHERE id = ?', [req.user.id])
    res.json({ code: 200, data: { balance: user.wallet_balance } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 流水记录
router.get('/transactions', auth, async (req, res) => {
  const { page = 1, limit = 20, type } = req.query
  const offset = (page - 1) * limit
  let query = 'SELECT * FROM wallet_transactions WHERE user_id = ?'
  const params = [req.user.id]
  if (type) { query += ' AND type = ?'; params.push(type) }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  try {
    const [list] = await pool.query(query, params)
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM wallet_transactions WHERE user_id = ?', [req.user.id])
    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 充值
router.post('/recharge', auth, async (req, res) => {
  const amt = parseFloat(req.body.amount)
  if (!amt || amt <= 0 || amt > 5000) return res.json({ code: 400, message: '充值金额不合法（1-5000元）' })
  try {
    const [[user]] = await pool.query('SELECT wallet_balance, points FROM users WHERE id = ?', [req.user.id])
    const newBalance = parseFloat((user.wallet_balance + amt).toFixed(2))
    await pool.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, req.user.id])
    await pool.query("INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after) VALUES (?, ?, 'recharge', '手动充值', ?)",
      [req.user.id, amt, newBalance])

    const earnPoints = Math.floor(amt / 10)
    if (earnPoints > 0) {
      const newPoints = user.points + earnPoints
      await pool.query('UPDATE users SET points = ? WHERE id = ?', [newPoints, req.user.id])
      await pool.query("INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, ?, 'earn', '充值赠积分', ?)",
        [req.user.id, earnPoints, newPoints])
    }
    res.json({
      code: 200,
      message: `充值成功${earnPoints > 0 ? `，赠送${earnPoints}积分` : ''}`,
      data: { balance: newBalance }
    })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

module.exports = router
