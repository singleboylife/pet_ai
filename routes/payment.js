const express = require('express')
const router  = express.Router()
const pool    = require('../database/db')
const auth    = require('../middleware/auth')

// 创建虚拟支付订单
router.post('/create', auth, async (req, res) => {
  const { amount, payment_method = 'alipay' } = req.body
  const amt = parseFloat(amount)

  if (!amt || amt <= 0 || amt > 10000) {
    return res.json({ code: 400, message: '充值金额不合法（1-10000元）' })
  }

  if (!['alipay', 'wechat'].includes(payment_method)) {
    return res.json({ code: 400, message: '支付方式不支持' })
  }

  try {
    // 生成订单号
    const order_no = `PAY${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    // 创建支付订单
    await pool.query(
      "INSERT INTO payment_orders (order_no, user_id, amount, payment_method, status) VALUES (?, ?, ?, ?, 'pending')",
      [order_no, req.user.id, amt, payment_method]
    )

    // 模拟支付：返回虚拟支付参数
    res.json({
      code: 200,
      message: '支付订单创建成功',
      data: {
        order_no,
        amount: amt,
        payment_method,
        // 虚拟支付提示
        mock_payment: true,
        tips: '这是虚拟支付，3秒后自动完成支付'
      }
    })

    // 3秒后自动完成支付（模拟支付回调）
    setTimeout(async () => {
      try {
        const conn = await pool.getConnection()
        await conn.beginTransaction()

        // 查询订单
        const [[order]] = await conn.query(
          'SELECT * FROM payment_orders WHERE order_no = ? AND status = ?',
          [order_no, 'pending']
        )

        if (!order) {
          await conn.rollback()
          conn.release()
          return
        }

        // 更新订单状态
        await conn.query(
          "UPDATE payment_orders SET status = 'paid', trade_no = ?, paid_at = NOW() WHERE order_no = ?",
          [`MOCK${Date.now()}`, order_no]
        )

        // 查询用户
        const [[user]] = await conn.query('SELECT wallet_balance, points FROM users WHERE id = ?', [order.user_id])

        // 更新钱包余额
        const newBalance = parseFloat((user.wallet_balance + order.amount).toFixed(2))
        await conn.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, order.user_id])

        // 记录钱包流水
        await conn.query(
          "INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after) VALUES (?, ?, 'recharge', ?, ?)",
          [order.user_id, order.amount, `${payment_method === 'alipay' ? '支付宝' : '微信'}充值`, newBalance]
        )

        // 赠送积分（充值10元送1积分）
        const earnPoints = Math.floor(order.amount / 10)
        if (earnPoints > 0) {
          const newPoints = user.points + earnPoints
          await conn.query('UPDATE users SET points = ? WHERE id = ?', [newPoints, order.user_id])
          await conn.query(
            "INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, ?, 'earn', '充值赠积分', ?)",
            [order.user_id, earnPoints, newPoints]
          )
        }

        await conn.commit()
        conn.release()
      } catch (err) {
        console.error('[虚拟支付回调错误]', err)
      }
    }, 3000)

  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 查询支付订单状态
router.get('/query/:order_no', auth, async (req, res) => {
  try {
    const [[order]] = await pool.query(
      'SELECT order_no, amount, payment_method, status, trade_no, created_at, paid_at FROM payment_orders WHERE order_no = ? AND user_id = ?',
      [req.params.order_no, req.user.id]
    )

    if (!order) {
      return res.json({ code: 404, message: '订单不存在' })
    }

    res.json({ code: 200, data: order })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 支付订单列表
router.get('/orders', auth, async (req, res) => {
  const { page = 1, limit = 20, status } = req.query
  const offset = (page - 1) * limit

  let query = 'SELECT * FROM payment_orders WHERE user_id = ?'
  const params = [req.user.id]

  if (status) {
    query += ' AND status = ?'
    params.push(status)
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))

  try {
    const [list] = await pool.query(query, params)
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) as cnt FROM payment_orders WHERE user_id = ?',
      [req.user.id]
    )

    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

module.exports = router
