const express = require('express')
const router  = express.Router()
const multer  = require('multer')
const pool    = require('../database/db')
const auth    = require('../middleware/auth')
const { uploadBuffer, avatarKey } = require('../utils/cos')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

// 获取自己的资料
router.get('/profile', auth, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      'SELECT id, username, nickname, avatar, bio, phone, email, is_member, member_expire, points, wallet_balance, created_at FROM users WHERE id = ?',
      [req.user.id]
    )
    if (!user) return res.json({ code: 404, message: '用户不存在' })
    if (user.is_member && user.member_expire && new Date(user.member_expire) < new Date()) {
      await pool.query('UPDATE users SET is_member = 0 WHERE id = ?', [user.id])
      user.is_member = 0
    }
    res.json({ code: 200, data: user })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 更新资料
router.put('/profile', auth, async (req, res) => {
  const { nickname, bio, phone, email } = req.body
  const fields = [], values = []
  if (nickname !== undefined) { fields.push('nickname = ?'); values.push(nickname) }
  if (bio      !== undefined) { fields.push('bio = ?');      values.push(bio) }
  if (phone    !== undefined) { fields.push('phone = ?');    values.push(phone) }
  if (email    !== undefined) { fields.push('email = ?');    values.push(email) }
  if (!fields.length) return res.json({ code: 400, message: '没有需要更新的字段' })
  values.push(req.user.id)
  try {
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    res.json({ code: 200, message: '资料更新成功' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 上传头像
router.post('/upload-avatar', auth, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.json({ code: 400, message: '请上传头像图片' })
  const ext = req.file.mimetype === 'image/png' ? '.png' : '.jpg'
  const key = avatarKey(req.user.id, ext)
  try {
    const url = await uploadBuffer(req.file.buffer, key, req.file.mimetype)
    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [url, req.user.id])
    res.json({ code: 200, message: '头像上传成功', data: { avatar: url } })
  } catch (err) { res.json({ code: 500, message: 'COS 上传失败: ' + err.message }) }
})

// 获取未读通知数量
router.get('/notifications/unread-count', auth, async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT COUNT(*) as cnt FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id])
    res.json({ code: 200, data: { count: row.cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 获取通知列表
router.get('/notifications/list', auth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit
  try {
    const [list] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [req.user.id, parseInt(limit), parseInt(offset)]
    )
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id])
    res.json({ code: 200, data: list })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 收货地址列表
router.get('/addresses/list', auth, async (req, res) => {
  try {
    const [list] = await pool.query('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC', [req.user.id])
    res.json({ code: 200, data: list })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 新增地址
router.post('/addresses', auth, async (req, res) => {
  const { name, phone, province, city, district, detail, is_default } = req.body
  if (!name || !phone || !detail) return res.json({ code: 400, message: '姓名、电话和详细地址为必填' })
  try {
    if (is_default) await pool.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id])
    const [result] = await pool.query(
      'INSERT INTO addresses (user_id, name, phone, province, city, district, detail, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name, phone, province || '', city || '', district || '', detail, is_default ? 1 : 0]
    )
    res.json({ code: 200, message: '地址添加成功', data: { id: result.insertId } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 修改地址
router.put('/addresses/:id', auth, async (req, res) => {
  const { name, phone, province, city, district, detail, is_default } = req.body
  try {
    const [[addr]] = await pool.query('SELECT * FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
    if (!addr) return res.json({ code: 404, message: '地址不存在' })
    if (is_default) await pool.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id])
    await pool.query(
      'UPDATE addresses SET name=?, phone=?, province=?, city=?, district=?, detail=?, is_default=? WHERE id=?',
      [name, phone, province, city, district, detail, is_default ? 1 : 0, req.params.id]
    )
    res.json({ code: 200, message: '地址更新成功' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 删除地址
router.delete('/addresses/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
    res.json({ code: 200, message: '地址已删除' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 获取他人资料
router.get('/:id', auth, async (req, res) => {
  try {
    const [[user]] = await pool.query(
      'SELECT id, username, nickname, avatar, bio, is_member, created_at FROM users WHERE id = ?',
      [req.params.id]
    )
    if (!user) return res.json({ code: 404, message: '用户不存在' })
    const [[friendship]] = await pool.query(
      'SELECT status FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)',
      [req.user.id, req.params.id, req.params.id, req.user.id]
    )
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?', [req.params.id])
    res.json({ code: 200, data: { ...user, friend_status: friendship ? friendship.status : 'none', post_count: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

module.exports = router
