const express = require('express')
const router = express.Router()
const pool = require('../database/db')
const auth = require('../middleware/auth')
const logger = require('../utils/logger')
const multer = require('multer')
const { uploadBuffer, merchantLogoKey, merchantLicenseKey, merchantBannerKey } = require('../utils/cos')

const upload = multer({ storage: multer.memoryStorage() })

// 商家入驻申请
router.post('/apply', auth, async (req, res) => {
  const { shop_name, contact_name, contact_phone, description } = req.body
  if (!shop_name || !contact_name || !contact_phone) {
    return res.json({ code: 400, message: '请填写完整信息' })
  }
  try {
    const [[exists]] = await pool.query('SELECT id FROM merchants WHERE user_id = ?', [req.user.id])
    if (exists) return res.json({ code: 400, message: '您已提交过申请' })

    await pool.query(
      'INSERT INTO merchants (user_id, shop_name, contact_name, contact_phone, description, shop_type) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, shop_name, contact_name, contact_phone, description, 'third_party']
    )
    res.json({ code: 200, message: '申请已提交，等待审核' })
  } catch (err) {
    logger.routeError('[Merchant]', err, { userId: req.user.id })
    res.json({ code: 500, message: err.message })
  }
})

// 上传营业执照
router.post('/upload-license', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ code: 400, message: '请上传文件' })
  try {
    const [[merchant]] = await pool.query('SELECT id FROM merchants WHERE user_id = ?', [req.user.id])
    if (!merchant) return res.json({ code: 404, message: '请先提交入驻申请' })

    const key = merchantLicenseKey(merchant.id, '.jpg')
    const url = await uploadBuffer(req.file.buffer, key, req.file.mimetype)
    await pool.query('UPDATE merchants SET business_license = ? WHERE id = ?', [url, merchant.id])
    res.json({ code: 200, data: { url } })
  } catch (err) {
    logger.routeError('[Merchant]', err)
    res.json({ code: 500, message: err.message })
  }
})

// 上传店铺Logo
router.post('/upload-logo', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ code: 400, message: '请上传文件' })
  try {
    const [[merchant]] = await pool.query('SELECT id FROM merchants WHERE user_id = ?', [req.user.id])
    if (!merchant) return res.json({ code: 404, message: '商家不存在' })

    const key = merchantLogoKey(merchant.id, '.jpg')
    const url = await uploadBuffer(req.file.buffer, key, req.file.mimetype)
    await pool.query('UPDATE merchants SET shop_logo = ? WHERE id = ?', [url, merchant.id])
    res.json({ code: 200, data: { url } })
  } catch (err) {
    logger.routeError('[Merchant]', err)
    res.json({ code: 500, message: err.message })
  }
})

// 获取商家信息
router.get('/info', auth, async (req, res) => {
  try {
    const [[merchant]] = await pool.query('SELECT * FROM merchants WHERE user_id = ?', [req.user.id])
    res.json({ code: 200, data: merchant || null })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 商家列表（用户端）
router.get('/list', auth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit
  try {
    const [list] = await pool.query(
      'SELECT id, shop_name, shop_logo, shop_type, rating, sales_count, description FROM merchants WHERE status = ? ORDER BY sales_count DESC LIMIT ? OFFSET ?',
      ['approved', parseInt(limit), parseInt(offset)]
    )
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM merchants WHERE status = ?', ['approved'])
    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

// 商家详情
router.get('/:id', auth, async (req, res) => {
  try {
    const [[merchant]] = await pool.query(
      'SELECT id, shop_name, shop_logo, shop_banner, shop_type, rating, sales_count, description FROM merchants WHERE id = ? AND status = ?',
      [req.params.id, 'approved']
    )
    if (!merchant) return res.json({ code: 404, message: '商家不存在' })
    res.json({ code: 200, data: merchant })
  } catch (err) {
    res.json({ code: 500, message: err.message })
  }
})

module.exports = router
