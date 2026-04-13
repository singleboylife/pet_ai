const express = require('express')
const router = express.Router()
const pool = require('../database/db')
const auth = require('../middleware/auth')

// 简单的管理员验证中间件
const adminAuth = async (req, res, next) => {
  if (!req.user) return res.json({ code: 401, message: '未登录' })
  const [[user]] = await pool.query('SELECT role FROM users WHERE id = ?', [req.user.id])
  if (!user || user.role !== 'admin') {
    return res.json({ code: 403, message: '无权限' })
  }
  next()
}

// 获取待审核商家列表
router.get('/merchants/pending', auth, adminAuth, async (req, res) => {
  try {
    const [list] = await pool.query(
      'SELECT m.*, u.username, u.phone FROM merchants m LEFT JOIN users u ON m.user_id = u.id WHERE m.status = ? ORDER BY m.created_at DESC',
      ['pending']
    )
    res.json({ code: 200, data: list })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 审核通过
router.put('/merchants/:id/approve', auth, adminAuth, async (req, res) => {
  try {
    await pool.query('UPDATE merchants SET status = ?, updated_at = NOW() WHERE id = ?', ['approved', req.params.id])
    res.json({ code: 200, message: '审核通过' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 审核拒绝
router.put('/merchants/:id/reject', auth, adminAuth, async (req, res) => {
  const { reason } = req.body
  try {
    await pool.query('UPDATE merchants SET status = ?, reject_reason = ?, updated_at = NOW() WHERE id = ?', ['rejected', reason || '', req.params.id])
    res.json({ code: 200, message: '已拒绝' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 获取所有商家列表（含状态）
router.get('/merchants/all', auth, adminAuth, async (req, res) => {
  try {
    const [list] = await pool.query(
      'SELECT m.*, u.username FROM merchants m LEFT JOIN users u ON m.user_id = u.id ORDER BY m.created_at DESC'
    )
    res.json({ code: 200, data: list })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// ============ 订单管理 ============

// 获取所有订单列表
router.get('/orders', auth, adminAuth, async (req, res) => {
  const { page = 1, limit = 20, status, keyword } = req.query
  const offset = (page - 1) * limit

  let query = `
    SELECT o.*, u.username, u.phone as user_phone
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    WHERE 1=1
  `
  const params = []

  if (status) {
    query += ' AND o.status = ?'
    params.push(status)
  }

  if (keyword) {
    query += ' AND (o.order_no LIKE ? OR u.username LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))

  try {
    const [list] = await pool.query(query, params)

    // 解析 JSON 字段
    list.forEach(order => {
      order.items = order.items || []
      order.address = order.address || {}
      order.merchant_orders = order.merchant_orders || {}
    })

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as cnt FROM orders WHERE 1=1'
    const countParams = []
    if (status) {
      countQuery += ' AND status = ?'
      countParams.push(status)
    }
    const [[{ cnt }]] = await pool.query(countQuery, countParams)

    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 获取订单详情
router.get('/orders/:id', auth, adminAuth, async (req, res) => {
  try {
    const [[order]] = await pool.query(
      `SELECT o.*, u.username, u.phone as user_phone, u.email as user_email
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [req.params.id]
    )

    if (!order) {
      return res.json({ code: 404, message: '订单不存在' })
    }

    order.items = order.items || []
    order.address = order.address || {}
    order.merchant_orders = order.merchant_orders || {}

    res.json({ code: 200, data: order })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 更新订单状态
router.put('/orders/:id/status', auth, adminAuth, async (req, res) => {
  const { status } = req.body
  const validStatus = ['pending', 'paid', 'shipped', 'completed', 'cancelled']

  if (!validStatus.includes(status)) {
    return res.json({ code: 400, message: '无效的订单状态' })
  }

  try {
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id])
    if (!order) {
      return res.json({ code: 404, message: '订单不存在' })
    }

    await pool.query('UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.id])

    // 如果改为已完成，记录完成时间
    if (status === 'completed') {
      await pool.query('UPDATE orders SET received_at = NOW() WHERE id = ?', [req.params.id])
    }

    res.json({ code: 200, message: '订单状态已更新' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 发货（更新物流信息）
router.put('/orders/:id/ship', auth, adminAuth, async (req, res) => {
  const { shipping_company, tracking_number } = req.body

  if (!shipping_company || !tracking_number) {
    return res.json({ code: 400, message: '请填写物流公司和物流单号' })
  }

  try {
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id])

    if (!order) {
      return res.json({ code: 404, message: '订单不存在' })
    }

    if (order.status !== 'paid') {
      return res.json({ code: 400, message: '只有已支付的订单才能发货' })
    }

    await pool.query(
      "UPDATE orders SET status = 'shipped', shipping_company = ?, tracking_number = ?, shipped_at = NOW(), updated_at = NOW() WHERE id = ?",
      [shipping_company, tracking_number, req.params.id]
    )

    // 发送通知给用户
    await pool.query(
      "INSERT INTO notifications (user_id, type, content, ref_id, ref_type) VALUES (?, 'order', ?, ?, 'order')",
      [order.user_id, `您的订单 ${order.order_no} 已发货，物流公司：${shipping_company}，单号：${tracking_number}`, order.id]
    )

    res.json({ code: 200, message: '发货成功' })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 订单统计
router.get('/orders/stats/summary', auth, adminAuth, async (req, res) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END) as shipped_count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_count,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN status IN ('paid', 'shipped', 'completed') THEN total_amount ELSE 0 END) as total_revenue
      FROM orders
    `)

    res.json({ code: 200, data: stats })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

module.exports = router
