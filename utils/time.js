/**
 * 本地时间工具
 * 解决 new Date().toISOString() / SQLite CURRENT_TIMESTAMP 都是 UTC 的问题
 */

const pad = n => String(n).padStart(2, '0')

/** 返回本地日期字符串 'YYYY-MM-DD' */
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 返回本地日期时间字符串 'YYYY-MM-DD HH:MM:SS' */
function localDateTime(d = new Date()) {
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

module.exports = { localDate, localDateTime }
