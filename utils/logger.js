/**
 * 日志工具
 * 通过环境变量控制级别和格式：
 *   LOG_LEVEL=debug | info | warn | error  (默认 debug)
 *   NODE_ENV=development | production
 *
 * debug  模式：彩色控制台 + 详细请求体 + 完整堆栈
 * 生产模式：纯文本控制台 + 仅关键字段 + 写入日志文件
 */

const fs   = require('fs')
const path = require('path')

// ── 级别定义 ─────────────────────────────────────────────
const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }

const ENV       = (process.env.NODE_ENV  || 'development').toLowerCase()
const IS_DEV    = ENV === 'development'
const LOG_LEVEL = (process.env.LOG_LEVEL || (IS_DEV ? 'debug' : 'info')).toLowerCase()
const CUR_LEVEL = LEVELS[LOG_LEVEL] ?? LEVELS.debug

// ── 颜色（仅开发模式使用 ANSI） ───────────────────────────
const C = IS_DEV ? {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  debug:  '\x1b[36m',   // cyan
  info:   '\x1b[32m',   // green
  warn:   '\x1b[33m',   // yellow
  error:  '\x1b[31m',   // red
  method: '\x1b[35m',   // magenta
  status: '\x1b[34m',   // blue
} : {}
const colored = (color, str) => IS_DEV ? `${C[color] || ''}${str}${C.reset}` : str

// ── 本地时间格式化（替代 toISOString 的 UTC 时间） ────────
function localTime() {
  const d   = new Date()
  const pad = n => String(n).padStart(2, '0')
  const ms  = String(d.getMilliseconds()).padStart(3, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`
}

// ── 日志文件 ─────────────────────────────────────────────
const logsDir = path.join(__dirname, '..', 'logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir)

function getLogStream() {
  const d   = new Date()
  const pad = n => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  return fs.createWriteStream(path.join(logsDir, `${date}.log`), { flags: 'a' })
}

function writeFile(level, message) {
  const time = localTime()
  getLogStream().write(`[${time}] [${level.toUpperCase().padEnd(5)}] ${message}\n`)
}

// ── 格式化任意值 ─────────────────────────────────────────
function fmt(val) {
  if (val === null || val === undefined) return String(val)
  if (val instanceof Error) {
    return IS_DEV
      ? `${val.message}\n${colored('dim', val.stack || '')}`
      : val.message
  }
  if (typeof val === 'object') {
    try { return JSON.stringify(val, null, IS_DEV ? 2 : 0) } catch { return String(val) }
  }
  return String(val)
}

// ── 脱敏：过滤请求体中的敏感字段 ────────────────────────
const SENSITIVE = ['password', 'token', 'secret', 'key', 'Authorization']
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE.some(s => k.toLowerCase().includes(s.toLowerCase()))
      ? '***'
      : (typeof v === 'object' ? sanitize(v) : v)
  }
  return out
}

// ── 核心输出函数 ─────────────────────────────────────────
function output(level, args) {
  if (LEVELS[level] < CUR_LEVEL) return

  const time   = localTime()
  const prefix = IS_DEV
    ? `${colored('dim', time)} ${colored(level, `[${level.toUpperCase().padEnd(5)}]`)}`
    : `[${time}] [${level.toUpperCase().padEnd(5)}]`

  const message = args.map(fmt).join(' ')
  const line    = `${prefix} ${message}`

  if (level === 'error') {
    console.error(line)   // stderr
  } else {
    console.log(line)     // stdout
  }

  writeFile(level, args.map(a => a instanceof Error ? (a.stack || a.message) : fmt(a)).join(' '))
}

// ── 公开 API ─────────────────────────────────────────────
const logger = {
  debug : (...args) => output('debug', args),
  info  : (...args) => output('info',  args),
  warn  : (...args) => output('warn',  args),
  error : (...args) => output('error', args),

  /**
   * Express 请求日志中间件
   * debug 模式：打印 method / url / headers(部分) / body
   * 所有模式：请求结束后打印 status / 耗时
   */
  requestMiddleware() {
    return (req, res, next) => {
      const start = Date.now()

      // ── 请求进入 ─────────────────────────────────────
      if (IS_DEV && CUR_LEVEL <= LEVELS.debug) {
        const method = colored('method', req.method.padEnd(7))
        logger.debug(
          `${colored('bold', '→ REQ')} ${method} ${req.originalUrl}`
        )

        // 请求头（只打印常用的，跳过敏感）
        const usefulHeaders = {}
        for (const h of ['content-type', 'user-agent', 'x-forwarded-for', 'referer']) {
          if (req.headers[h]) usefulHeaders[h] = req.headers[h]
        }
        if (Object.keys(usefulHeaders).length) {
          logger.debug('  Headers:', usefulHeaders)
        }

        // 请求体（脱敏后打印，debug模式）
        if (req.body && Object.keys(req.body).length) {
          logger.debug('  Body   :', sanitize(req.body))
        }

        // query 参数
        if (req.query && Object.keys(req.query).length) {
          logger.debug('  Query  :', req.query)
        }

        // 登录用户信息
        if (req.user) {
          logger.debug(`  User   : id=${req.user.id} username=${req.user.username}`)
        }
      }

      // ── 响应结束 ─────────────────────────────────────
      const originalJson = res.json.bind(res)
      res.json = function (body) {
        const ms     = Date.now() - start
        const status = res.statusCode
        const code   = body && body.code !== undefined ? body.code : status

        // 状态着色
        const statusStr = IS_DEV
          ? (status >= 500 ? colored('error', status)
            : status >= 400 ? colored('warn', status)
            : colored('info', status))
          : String(status)

        const method = colored('method', req.method.padEnd(7))
        const msStr  = ms > 500 ? colored('warn', `${ms}ms`) : colored('dim', `${ms}ms`)

        if (code >= 500 || status >= 500) {
          logger.error(`${colored('bold', '← RES')} ${method} ${req.originalUrl} ${statusStr} code=${code} ${msStr}`)
          if (IS_DEV && body && body.message) logger.error('  Message:', body.message)
        } else if (code >= 400 || status >= 400) {
          logger.warn(`${colored('bold', '← RES')} ${method} ${req.originalUrl} ${statusStr} code=${code} ${msStr}`)
          if (IS_DEV && body && body.message) logger.warn('  Message:', body.message)
        } else {
          logger.info(`${colored('bold', '← RES')} ${method} ${req.originalUrl} ${statusStr} code=${code} ${msStr}`)
          // debug 模式下打印响应体摘要（只打印 code/message，不打印完整 data）
          if (IS_DEV && CUR_LEVEL <= LEVELS.debug && body) {
            const summary = { code: body.code, message: body.message }
            if (body.data !== undefined) summary.data = '[...]'
            logger.debug('  ResBody:', summary)
          }
        }

        return originalJson(body)
      }

      next()
    }
  },

  // 便捷：记录路由级错误（带完整上下文）
  routeError(label, err, extra) {
    logger.error(`[${label}]`, err instanceof Error ? err : new Error(String(err)))
    if (extra && IS_DEV) logger.debug(`  Context:`, extra)
  },

  // 暴露工具给外部使用
  sanitize,
  IS_DEV,
  CUR_LEVEL,
  LEVELS,
}

module.exports = logger
