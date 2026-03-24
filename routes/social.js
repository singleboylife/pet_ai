const express = require('express')
const router  = express.Router()
const multer  = require('multer')
const pool    = require('../database/db')
const auth    = require('../middleware/auth')
const { uploadBuffer, postImageKey } = require('../utils/cos')

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

// 广场动态列表
router.get('/posts', auth, async (req, res) => {
  const { page = 1, limit = 15, keyword, friends_only, category } = req.query
  const offset = (page - 1) * limit
  let query = `
    SELECT p.*, u.nickname, u.avatar, u.is_member,
      CASE WHEN pl.id IS NOT NULL THEN 1 ELSE 0 END AS is_liked
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = ?
    WHERE 1=1
  `
  const params = [req.user.id]
  if (friends_only === '1') {
    query += ` AND p.user_id IN (
      SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END
      FROM friendships WHERE (requester_id = ? OR addressee_id = ?) AND status = 'accepted'
    )`
    params.push(req.user.id, req.user.id, req.user.id)
  }
  if (category) { query += ' AND p.category = ?'; params.push(category) }
  if (keyword)  { query += ' AND p.content LIKE ?'; params.push(`%${keyword}%`) }
  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  try {
    const [list] = await pool.query(query, params)
    list.forEach(p => { p.images = p.images || [] })
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM posts')
    res.json({ code: 200, data: { list, total: cnt, page: parseInt(page), limit: parseInt(limit) } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 热门动态
router.get('/hot', auth, async (req, res) => {
  const { page = 1, limit = 15 } = req.query
  const offset = (page - 1) * limit
  try {
    const [list] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar, u.is_member,
        CASE WHEN pl.id IS NOT NULL THEN 1 ELSE 0 END AS is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = ?
      ORDER BY p.likes_count DESC, p.comments_count DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `, [req.user.id, parseInt(limit), parseInt(offset)])
    list.forEach(p => { p.images = p.images || [] })
    res.json({ code: 200, data: list })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 发布动态
router.post('/posts', auth, upload.array('images', 9), async (req, res) => {
  const { content } = req.body
  if (!content || !content.trim()) return res.json({ code: 400, message: '动态内容不能为空' })
  let imageUrls = []
  if (req.files && req.files.length > 0) {
    try {
      const mimeMap = {
        'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
        'image/gif': '.gif', 'image/webp': '.webp',
        'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/x-msvideo': '.avi'
      }
      imageUrls = await Promise.all(req.files.map(file => {
        const ext = mimeMap[file.mimetype] || '.jpg'
        return uploadBuffer(file.buffer, postImageKey(req.user.id, ext), file.mimetype)
      }))
    } catch (err) { return res.json({ code: 500, message: '媒体上传失败: ' + err.message }) }
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO posts (user_id, content, images) VALUES (?, ?, ?)',
      [req.user.id, content.trim(), JSON.stringify(imageUrls)]
    )
    const [[user]] = await pool.query('SELECT points FROM users WHERE id = ?', [req.user.id])
    const newPoints = user.points + 5
    await pool.query('UPDATE users SET points = ? WHERE id = ?', [newPoints, req.user.id])
    await pool.query(
      "INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, 5, 'earn', '发布动态赠积分', ?)",
      [req.user.id, newPoints]
    )
    const [[post]] = await pool.query(
      'SELECT p.*, u.nickname, u.avatar FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?',
      [result.insertId]
    )
    post.images = post.images || []
    res.json({ code: 200, message: '发布成功', data: post })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 删除动态
router.delete('/posts/:id', auth, async (req, res) => {
  try {
    const [[post]] = await pool.query('SELECT * FROM posts WHERE id = ?', [req.params.id])
    if (!post) return res.json({ code: 404, message: '动态不存在' })
    if (post.user_id !== req.user.id) return res.json({ code: 403, message: '无权删除' })
    await pool.query('DELETE FROM post_likes WHERE post_id = ?', [req.params.id])
    await pool.query('DELETE FROM post_comments WHERE post_id = ?', [req.params.id])
    await pool.query('DELETE FROM posts WHERE id = ?', [req.params.id])
    res.json({ code: 200, message: '已删除' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 点赞
router.post('/posts/:id/like', auth, async (req, res) => {
  try {
    const [[post]] = await pool.query('SELECT * FROM posts WHERE id = ?', [req.params.id])
    if (!post) return res.json({ code: 404, message: '动态不存在' })
    await pool.query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [req.params.id, req.user.id])
    await pool.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?', [req.params.id])
    if (post.user_id !== req.user.id) {
      const [[me]] = await pool.query('SELECT nickname FROM users WHERE id = ?', [req.user.id])
      await pool.query(
        "INSERT INTO notifications (user_id, type, content, ref_id, ref_type) VALUES (?, 'like', ?, ?, 'post')",
        [post.user_id, `${me.nickname} 赞了你的动态`, post.id]
      )
    }
    if (post.likes_count + 1 >= 50) {
      await pool.query('UPDATE posts SET is_hot = 1 WHERE id = ?', [req.params.id])
    }
    res.json({ code: 200, message: '点赞成功' })
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.json({ code: 400, message: '已经点赞过了' })
    res.json({ code: 500, message: err.message })
  }
})

// 取消点赞
router.delete('/posts/:id/like', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.id, req.user.id])
    await pool.query('UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?', [req.params.id])
    res.json({ code: 200, message: '已取消点赞' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 评论列表
router.get('/posts/:id/comments', auth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit
  try {
    const [list] = await pool.query(`
      SELECT c.*, u.nickname, u.avatar FROM post_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ? ORDER BY c.created_at ASC LIMIT ? OFFSET ?
    `, [req.params.id, parseInt(limit), parseInt(offset)])
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM post_comments WHERE post_id = ?', [req.params.id])
    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 发表评论
router.post('/posts/:id/comments', auth, async (req, res) => {
  const { content } = req.body
  if (!content || !content.trim()) return res.json({ code: 400, message: '评论内容不能为空' })
  try {
    const [[post]] = await pool.query('SELECT * FROM posts WHERE id = ?', [req.params.id])
    if (!post) return res.json({ code: 404, message: '动态不存在' })
    const [result] = await pool.query(
      'INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, content.trim()]
    )
    await pool.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?', [req.params.id])
    if (post.user_id !== req.user.id) {
      const [[me]] = await pool.query('SELECT nickname FROM users WHERE id = ?', [req.user.id])
      await pool.query(
        "INSERT INTO notifications (user_id, type, content, ref_id, ref_type) VALUES (?, 'comment', ?, ?, 'post')",
        [post.user_id, `${me.nickname} 评论了你的动态：${content.slice(0, 20)}`, post.id]
      )
    }
    const [[comment]] = await pool.query(
      'SELECT c.*, u.nickname, u.avatar FROM post_comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?',
      [result.insertId]
    )
    res.json({ code: 200, message: '评论成功', data: comment })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 动态详情
router.get('/posts/:id', auth, async (req, res) => {
  try {
    const [[post]] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar, u.is_member,
        CASE WHEN pl.id IS NOT NULL THEN 1 ELSE 0 END AS is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = ?
      WHERE p.id = ?
    `, [req.user.id, req.params.id])
    if (!post) return res.json({ code: 404, message: '动态不存在' })
    post.images = post.images || []
    res.json({ code: 200, data: post })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 用户所有动态
router.get('/posts/user/:userId', auth, async (req, res) => {
  const { page = 1, limit = 12 } = req.query
  const offset = (page - 1) * limit
  try {
    const [list] = await pool.query(`
      SELECT p.*, u.nickname, u.avatar,
        CASE WHEN pl.id IS NOT NULL THEN 1 ELSE 0 END AS is_liked
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_likes pl ON pl.post_id = p.id AND pl.user_id = ?
      WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    `, [req.user.id, req.params.userId, parseInt(limit), parseInt(offset)])
    list.forEach(p => { p.images = p.images || [] })
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM posts WHERE user_id = ?', [req.params.userId])
    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 我的好友列表
router.get('/friends', auth, async (req, res) => {
  try {
    const [friends] = await pool.query(`
      SELECT u.id, u.nickname, u.avatar, u.bio, u.is_member, f.created_at as friend_since
      FROM friendships f
      JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
      WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
    `, [req.user.id, req.user.id, req.user.id])
    res.json({ code: 200, data: friends })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 发送好友申请
router.post('/friends/request/:userId', auth, async (req, res) => {
  const targetId = parseInt(req.params.userId)
  if (targetId === req.user.id) return res.json({ code: 400, message: '不能添加自己为好友' })
  try {
    const [[target]] = await pool.query('SELECT id FROM users WHERE id = ?', [targetId])
    if (!target) return res.json({ code: 404, message: '用户不存在' })
    const [[exists]] = await pool.query(
      'SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)',
      [req.user.id, targetId, targetId, req.user.id]
    )
    if (exists) {
      if (exists.status === 'accepted') return res.json({ code: 400, message: '你们已经是好友了' })
      if (exists.status === 'pending')  return res.json({ code: 400, message: '申请已发送，等待对方确认' })
    }
    await pool.query("INSERT INTO friendships (requester_id, addressee_id, status) VALUES (?, ?, 'pending')", [req.user.id, targetId])
    const [[me]] = await pool.query('SELECT nickname FROM users WHERE id = ?', [req.user.id])
    await pool.query(
      "INSERT INTO notifications (user_id, type, content, ref_id, ref_type) VALUES (?, 'friend_request', ?, ?, 'user')",
      [targetId, `${me.nickname} 向你发送了好友申请`, req.user.id]
    )
    res.json({ code: 200, message: '好友申请已发送' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 接受好友申请
router.put('/friends/accept/:userId', auth, async (req, res) => {
  const requesterId = parseInt(req.params.userId)
  try {
    const [[row]] = await pool.query(
      "SELECT * FROM friendships WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'",
      [requesterId, req.user.id]
    )
    if (!row) return res.json({ code: 404, message: '没有找到待处理的好友申请' })
    await pool.query("UPDATE friendships SET status = 'accepted' WHERE id = ?", [row.id])
    const [[me]] = await pool.query('SELECT nickname FROM users WHERE id = ?', [req.user.id])
    await pool.query(
      "INSERT INTO notifications (user_id, type, content, ref_id, ref_type) VALUES (?, 'friend_accept', ?, ?, 'user')",
      [requesterId, `${me.nickname} 接受了你的好友申请`, req.user.id]
    )
    res.json({ code: 200, message: '已成为好友' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 拒绝/删除好友
router.delete('/friends/:userId', auth, async (req, res) => {
  const targetId = parseInt(req.params.userId)
  try {
    await pool.query(
      'DELETE FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)',
      [req.user.id, targetId, targetId, req.user.id]
    )
    res.json({ code: 200, message: '操作成功' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 待处理申请列表
router.get('/friends/requests', auth, async (req, res) => {
  try {
    const [list] = await pool.query(`
      SELECT f.id, f.created_at, u.id as user_id, u.nickname, u.avatar, u.bio
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = ? AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `, [req.user.id])
    res.json({ code: 200, data: list })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 搜索用户
router.get('/search/users', auth, async (req, res) => {
  const { keyword } = req.query
  if (!keyword) return res.json({ code: 400, message: '请输入搜索关键词' })
  try {
    const [list] = await pool.query(
      'SELECT id, nickname, avatar, bio, is_member FROM users WHERE (nickname LIKE ? OR username LIKE ?) AND id != ? LIMIT 20',
      [`%${keyword}%`, `%${keyword}%`, req.user.id]
    )
    res.json({ code: 200, data: list })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

module.exports = router
