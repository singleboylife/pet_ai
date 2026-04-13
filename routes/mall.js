const express = require('express')
const router  = express.Router()
const pool    = require('../database/db')
const auth    = require('../middleware/auth')
const multer  = require('multer')
const { uploadBuffer, productImageKey, productVideoKey, productDetailKey } = require('../utils/cos')

const upload = multer({ storage: multer.memoryStorage() })

// 商品列表
router.get('/products', auth, async (req, res) => {
  const { page = 1, limit = 12, category, keyword, sort = 'created_at', shop_type, merchant_id } = req.query
  const offset = (page - 1) * limit
  let query = `SELECT p.*, m.shop_name, m.shop_logo, m.shop_type as merchant_shop_type
               FROM products p LEFT JOIN merchants m ON p.merchant_id = m.id
               WHERE p.is_active = 1`
  const params = []
  if (category)    { query += ' AND p.category = ?'; params.push(category) }
  if (keyword)     { query += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`) }
  if (shop_type)   { query += ' AND p.shop_type = ?'; params.push(shop_type) }
  if (merchant_id) { query += ' AND p.merchant_id = ?'; params.push(merchant_id) }
  const sortMap = { sales: 'p.sales DESC', price_asc: 'p.price ASC', price_desc: 'p.price DESC', newest: 'p.created_at DESC' }
  query += ` ORDER BY ${sortMap[sort] || 'p.created_at DESC'} LIMIT ? OFFSET ?`
  params.push(parseInt(limit), parseInt(offset))
  try {
    const [list] = await pool.query(query, params)
    let countQuery = 'SELECT COUNT(*) as cnt FROM products WHERE is_active = 1'
    const countParams = []
    if (category)    { countQuery += ' AND category = ?'; countParams.push(category) }
    if (keyword)     { countQuery += ' AND (name LIKE ? OR description LIKE ?)'; countParams.push(`%${keyword}%`, `%${keyword}%`) }
    if (shop_type)   { countQuery += ' AND shop_type = ?'; countParams.push(shop_type) }
    if (merchant_id) { countQuery += ' AND merchant_id = ?'; countParams.push(merchant_id) }
    const [[{ cnt }]] = await pool.query(countQuery, countParams)
    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 商品分类
router.get('/categories', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT category, COUNT(*) as count FROM products WHERE is_active = 1 GROUP BY category')
    res.json({ code: 200, data: rows })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 商品详情
router.get('/products/:id', auth, async (req, res) => {
  try {
    const [[product]] = await pool.query(
      `SELECT p.*, m.shop_name, m.shop_logo, m.shop_banner, m.rating as shop_rating, m.sales_count as shop_sales
       FROM products p LEFT JOIN merchants m ON p.merchant_id = m.id
       WHERE p.id = ? AND p.is_active = 1`,
      [req.params.id]
    )
    if (!product) return res.json({ code: 404, message: '商品不存在' })
    res.json({ code: 200, data: product })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 购物车列表
router.get('/cart', auth, async (req, res) => {
  try {
    const [list] = await pool.query(`
      SELECT c.id, c.quantity, c.created_at, p.id as product_id, p.name, p.price, p.original_price, p.image, p.stock
      FROM cart_items c JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ? AND p.is_active = 1 ORDER BY c.created_at DESC
    `, [req.user.id])
    const total = list.reduce((sum, item) => sum + item.price * item.quantity, 0)
    res.json({ code: 200, data: { list, total: parseFloat(total.toFixed(2)) } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 加入购物车
router.post('/cart', auth, async (req, res) => {
  const { product_id, quantity = 1 } = req.body
  if (!product_id) return res.json({ code: 400, message: '商品ID不能为空' })
  try {
    const [[product]] = await pool.query('SELECT * FROM products WHERE id = ? AND is_active = 1', [product_id])
    if (!product) return res.json({ code: 404, message: '商品不存在' })
    if (product.stock < quantity) return res.json({ code: 400, message: '库存不足' })
    const [[exists]] = await pool.query('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', [req.user.id, product_id])
    if (exists) {
      await pool.query('UPDATE cart_items SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?', [quantity, req.user.id, product_id])
    } else {
      await pool.query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)', [req.user.id, product_id, quantity])
    }
    res.json({ code: 200, message: '已加入购物车' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 更新购物车数量
router.put('/cart/:productId', auth, async (req, res) => {
  const { quantity } = req.body
  if (!quantity || quantity < 1) return res.json({ code: 400, message: '数量不合法' })
  try {
    const [[product]] = await pool.query('SELECT stock FROM products WHERE id = ?', [req.params.productId])
    if (product && product.stock < quantity) return res.json({ code: 400, message: '超出库存限制' })
    await pool.query('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?', [quantity, req.user.id, req.params.productId])
    res.json({ code: 200, message: '已更新' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 删除购物车商品
router.delete('/cart/:productId', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.productId])
    res.json({ code: 200, message: '已移除' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 创建订单
router.post('/orders', auth, async (req, res) => {
  const { items, address_id, payment_method = 'wallet', use_points = 0 } = req.body
  if (!items || !items.length) return res.json({ code: 400, message: '请选择商品' })
  if (!address_id) return res.json({ code: 400, message: '请选择收货地址' })
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [[address]] = await conn.query('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [address_id, req.user.id])
    if (!address) { await conn.rollback(); conn.release(); return res.json({ code: 400, message: '收货地址不存在' }) }
    const [[user]] = await conn.query('SELECT * FROM users WHERE id = ?', [req.user.id])

    let orderItems = [], subtotal = 0, merchantOrders = {}
    for (const item of items) {
      const [[product]] = await conn.query('SELECT * FROM products WHERE id = ? AND is_active = 1', [item.product_id])
      if (!product) { await conn.rollback(); conn.release(); return res.json({ code: 400, message: `商品 ${item.product_id} 不存在` }) }
      if (product.stock < item.quantity) { await conn.rollback(); conn.release(); return res.json({ code: 400, message: `${product.name} 库存不足` }) }
      subtotal += product.price * item.quantity
      orderItems.push({ ...product, quantity: item.quantity })

      const mid = product.merchant_id || 0
      if (!merchantOrders[mid]) {
        merchantOrders[mid] = { merchant_id: mid, shop_type: product.shop_type, items: [], subtotal: 0 }
      }
      merchantOrders[mid].items.push({ ...product, quantity: item.quantity })
      merchantOrders[mid].subtotal += product.price * item.quantity
    }

    let discountRate = 1
    if (user.is_member && user.member_expire && new Date(user.member_expire) > new Date()) discountRate = 0.9
    subtotal = parseFloat((subtotal * discountRate).toFixed(2))

    const pointsUsed = Math.min(parseInt(use_points) || 0, user.points, Math.floor(subtotal * 0.3 * 100))
    const pointsDiscount = pointsUsed > 0 ? parseFloat((pointsUsed / 100).toFixed(2)) : 0
    const totalAmount = parseFloat((subtotal - pointsDiscount).toFixed(2))

    if (payment_method === 'wallet' && user.wallet_balance < totalAmount) {
      await conn.rollback(); conn.release()
      return res.json({ code: 400, message: '钱包余额不足，请先充值' })
    }

    const orderNo = `PET${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const [result] = await conn.query(
      "INSERT INTO orders (order_no, user_id, total_amount, status, address, items, merchant_orders, payment_method, points_used) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)",
      [orderNo, req.user.id, totalAmount, JSON.stringify(address), JSON.stringify(orderItems), JSON.stringify(merchantOrders), payment_method, pointsUsed]
    )

    if (payment_method === 'wallet') {
      const newBalance = parseFloat((user.wallet_balance - totalAmount).toFixed(2))
      await conn.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, req.user.id])
      await conn.query("INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after) VALUES (?, ?, 'spend', ?, ?)",
        [req.user.id, -totalAmount, `订单${orderNo}支付`, newBalance])
      await conn.query("UPDATE orders SET status = 'paid' WHERE id = ?", [result.insertId])

      for (const item of orderItems) {
        await conn.query('UPDATE products SET stock = stock - ?, sales = sales + ? WHERE id = ?', [item.quantity, item.quantity, item.id])
      }
      if (pointsUsed > 0) {
        const newPoints = user.points - pointsUsed
        await conn.query('UPDATE users SET points = ? WHERE id = ?', [newPoints, req.user.id])
        await conn.query("INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, ?, 'spend', ?, ?)",
          [req.user.id, -pointsUsed, `订单${orderNo}积分抵扣`, newPoints])
      }
      const earnPoints = Math.floor(totalAmount / 10)
      if (earnPoints > 0) {
        await conn.query('UPDATE users SET points = points + ? WHERE id = ?', [earnPoints, req.user.id])
        const [[u2]] = await conn.query('SELECT points FROM users WHERE id = ?', [req.user.id])
        await conn.query("INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, ?, 'earn', ?, ?)",
          [req.user.id, earnPoints, `订单${orderNo}购物赠积分`, u2.points])
      }
      for (const item of orderItems) {
        await conn.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [req.user.id, item.id])
      }
    } else if (payment_method === 'direct') {
      // 直接支付模式（不扣钱包余额）
      await conn.query("UPDATE orders SET status = 'paid' WHERE id = ?", [result.insertId])

      for (const item of orderItems) {
        await conn.query('UPDATE products SET stock = stock - ?, sales = sales + ? WHERE id = ?', [item.quantity, item.quantity, item.id])
      }
      if (pointsUsed > 0) {
        const newPoints = user.points - pointsUsed
        await conn.query('UPDATE users SET points = ? WHERE id = ?', [newPoints, req.user.id])
        await conn.query("INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, ?, 'spend', ?, ?)",
          [req.user.id, -pointsUsed, `订单${orderNo}积分抵扣`, newPoints])
      }
      const earnPoints = Math.floor(totalAmount / 10)
      if (earnPoints > 0) {
        await conn.query('UPDATE users SET points = points + ? WHERE id = ?', [earnPoints, req.user.id])
        const [[u2]] = await conn.query('SELECT points FROM users WHERE id = ?', [req.user.id])
        await conn.query("INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, ?, 'earn', ?, ?)",
          [req.user.id, earnPoints, `订单${orderNo}购物赠积分`, u2.points])
      }
      for (const item of orderItems) {
        await conn.query('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?', [req.user.id, item.id])
      }
    }

    await conn.commit()
    conn.release()
    res.json({ code: 200, message: '下单成功', data: { order_id: result.insertId, order_no: orderNo, total_amount: totalAmount } })
  } catch (err) {
    await conn.rollback(); conn.release()
    res.json({ code: 500, message: err.message })
  }
})

// 我的订单列表
router.get('/orders', auth, async (req, res) => {
  const { page = 1, limit = 10, status } = req.query
  const offset = (page - 1) * limit
  let query = 'SELECT * FROM orders WHERE user_id = ?'
  const params = [req.user.id]
  if (status) { query += ' AND status = ?'; params.push(status) }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  try {
    const [list] = await pool.query(query, params)
    list.forEach(o => { o.items = o.items || []; o.address = o.address || {} })
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM orders WHERE user_id = ?', [req.user.id])
    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 订单详情
router.get('/orders/:id', auth, async (req, res) => {
  try {
    const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
    if (!order) return res.json({ code: 404, message: '订单不存在' })
    order.items = order.items || []; order.address = order.address || {}
    res.json({ code: 200, data: order })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 取消订单
router.put('/orders/:id/cancel', auth, async (req, res) => {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [[order]] = await conn.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
    if (!order) { await conn.rollback(); conn.release(); return res.json({ code: 404, message: '订单不存在' }) }
    if (!['pending', 'paid'].includes(order.status)) { await conn.rollback(); conn.release(); return res.json({ code: 400, message: '当前订单状态不可取消' }) }

    await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [order.id])

    if (order.status === 'paid' && order.payment_method === 'wallet') {
      const [[user]] = await conn.query('SELECT wallet_balance FROM users WHERE id = ?', [req.user.id])
      const newBalance = parseFloat((user.wallet_balance + order.total_amount).toFixed(2))
      await conn.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [newBalance, req.user.id])
      await conn.query("INSERT INTO wallet_transactions (user_id, amount, type, description, balance_after) VALUES (?, ?, 'refund', ?, ?)",
        [req.user.id, order.total_amount, `订单${order.order_no}退款`, newBalance])
      const items = order.items || []
      for (const item of items) {
        await conn.query('UPDATE products SET stock = stock + ?, sales = sales - ? WHERE id = ?', [item.quantity, item.quantity, item.id])
      }
    }
    await conn.commit(); conn.release()
    res.json({ code: 200, message: '订单已取消' })
  } catch (err) {
    await conn.rollback(); conn.release()
    res.json({ code: 500, message: err.message })
  }
})

// 上传商品图片（主图/轮播图）
router.post('/products/upload-image', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ code: 400, message: '请上传文件' })
  const { product_id = 'tmp', index = 0 } = req.body
  try {
    const key = productImageKey(product_id, index)
    const url = await uploadBuffer(req.file.buffer, key, req.file.mimetype)
    res.json({ code: 200, data: { url } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 上传商品视频
router.post('/products/upload-video', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ code: 400, message: '请上传文件' })
  const { product_id = 'tmp' } = req.body
  try {
    const key = productVideoKey(product_id)
    const url = await uploadBuffer(req.file.buffer, key, req.file.mimetype)
    res.json({ code: 200, data: { url } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 上传商品详情图
router.post('/products/upload-detail', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ code: 400, message: '请上传文件' })
  const { product_id = 'tmp', index = 0 } = req.body
  try {
    const key = productDetailKey(product_id, index)
    const url = await uploadBuffer(req.file.buffer, key, req.file.mimetype)
    res.json({ code: 200, data: { url } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 商家发布商品
router.post('/products', auth, async (req, res) => {
  const { name, description, price, original_price, stock, category, image, images, videos, detail_images } = req.body
  if (!name || !price || !stock) return res.json({ code: 400, message: '请填写完整商品信息' })
  try {
    const [[merchant]] = await pool.query('SELECT id FROM merchants WHERE user_id = ? AND status = ?', [req.user.id, 'approved'])
    if (!merchant) return res.json({ code: 403, message: '请先完成商家入驻审核' })

    const [result] = await pool.query(
      'INSERT INTO products (merchant_id, shop_type, name, description, price, original_price, stock, category, image, images, videos, detail_images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [merchant.id, 'third_party', name, description, price, original_price || price, stock, category, image, JSON.stringify(images || []), JSON.stringify(videos || []), JSON.stringify(detail_images || [])]
    )
    res.json({ code: 200, message: '商品发布成功', data: { product_id: result.insertId } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 商家更新商品
router.put('/products/:id', auth, async (req, res) => {
  const { name, description, price, original_price, stock, category, image, images, videos, detail_images, is_active } = req.body
  try {
    const [[merchant]] = await pool.query('SELECT id FROM merchants WHERE user_id = ?', [req.user.id])
    if (!merchant) return res.json({ code: 403, message: '无权限' })
    const [[product]] = await pool.query('SELECT id FROM products WHERE id = ? AND merchant_id = ?', [req.params.id, merchant.id])
    if (!product) return res.json({ code: 404, message: '商品不存在或无权限' })

    const fields = [], vals = []
    if (name !== undefined)           { fields.push('name = ?');           vals.push(name) }
    if (description !== undefined)    { fields.push('description = ?');    vals.push(description) }
    if (price !== undefined)          { fields.push('price = ?');          vals.push(price) }
    if (original_price !== undefined) { fields.push('original_price = ?'); vals.push(original_price) }
    if (stock !== undefined)          { fields.push('stock = ?');          vals.push(stock) }
    if (category !== undefined)       { fields.push('category = ?');       vals.push(category) }
    if (image !== undefined)          { fields.push('image = ?');          vals.push(image) }
    if (images !== undefined)         { fields.push('images = ?');         vals.push(JSON.stringify(images)) }
    if (videos !== undefined)         { fields.push('videos = ?');         vals.push(JSON.stringify(videos)) }
    if (detail_images !== undefined)  { fields.push('detail_images = ?');  vals.push(JSON.stringify(detail_images)) }
    if (is_active !== undefined)      { fields.push('is_active = ?');      vals.push(is_active) }
    if (!fields.length) return res.json({ code: 400, message: '没有可更新的字段' })

    vals.push(req.params.id)
    await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, vals)
    res.json({ code: 200, message: '更新成功' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 商家商品列表（商家后台）
router.get('/merchant/products', auth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit
  try {
    const [[merchant]] = await pool.query('SELECT id FROM merchants WHERE user_id = ?', [req.user.id])
    if (!merchant) return res.json({ code: 403, message: '无权限' })

    const [list] = await pool.query(
      'SELECT * FROM products WHERE merchant_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [merchant.id, parseInt(limit), parseInt(offset)]
    )
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM products WHERE merchant_id = ?', [merchant.id])
    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

module.exports = router
