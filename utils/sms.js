const pool = require('../database/db')

/**
 * 生成6位数字验证码
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 发送验证码（模拟）
 * 实际使用时需要接入阿里云、腾讯云等短信服务
 */
async function sendSMS(phone, code) {
  // 开发环境：直接打印到控制台
  if (process.env.NODE_ENV === 'development') {
    console.log(`[短信验证码] 手机号: ${phone}, 验证码: ${code}`)
    return { success: true }
  }

  // 生产环境：接入真实短信服务
  // TODO: 接入阿里云短信、腾讯云短信等
  // const result = await aliyunSMS.send(phone, code)
  // return result

  // 暂时返回成功
  return { success: true }
}

/**
 * 创建验证码
 */
async function createVerificationCode(phone, type = 'bind') {
  const code = generateCode()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5分钟后过期

  try {
    // 删除该手机号未使用的旧验证码
    await pool.query(
      'DELETE FROM verification_codes WHERE phone = ? AND type = ? AND used = 0',
      [phone, type]
    )

    // 插入新验证码
    await pool.query(
      'INSERT INTO verification_codes (phone, code, type, expires_at) VALUES (?, ?, ?, ?)',
      [phone, code, type, expiresAt]
    )

    // 发送短信
    await sendSMS(phone, code)

    return { success: true, code: process.env.NODE_ENV === 'development' ? code : undefined }
  } catch (err) {
    console.error('创建验证码失败:', err)
    throw new Error('发送验证码失败')
  }
}

/**
 * 验证验证码
 */
async function verifyCode(phone, code, type = 'bind') {
  try {
    const [[record]] = await pool.query(
      `SELECT * FROM verification_codes
       WHERE phone = ? AND code = ? AND type = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone, code, type]
    )

    if (!record) {
      return { success: false, message: '验证码错误或已过期' }
    }

    // 标记为已使用
    await pool.query('UPDATE verification_codes SET used = 1 WHERE id = ?', [record.id])

    return { success: true }
  } catch (err) {
    console.error('验证验证码失败:', err)
    return { success: false, message: '验证失败' }
  }
}

/**
 * 检查手机号是否已注册
 */
async function isPhoneRegistered(phone) {
  const [[user]] = await pool.query('SELECT id FROM users WHERE phone = ?', [phone])
  return !!user
}

module.exports = {
  generateCode,
  sendSMS,
  createVerificationCode,
  verifyCode,
  isPhoneRegistered
}
