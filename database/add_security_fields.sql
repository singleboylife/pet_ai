-- 添加安全相关字段到用户表
ALTER TABLE users
ADD COLUMN phone VARCHAR(20) DEFAULT NULL COMMENT '手机号',
ADD COLUMN phone_verified TINYINT(1) DEFAULT 0 COMMENT '手机号是否验证',
ADD COLUMN id_card VARCHAR(18) DEFAULT NULL COMMENT '身份证号',
ADD COLUMN real_name VARCHAR(50) DEFAULT NULL COMMENT '真实姓名',
ADD COLUMN id_verified TINYINT(1) DEFAULT 0 COMMENT '身份证是否验证',
ADD COLUMN id_verified_at DATETIME DEFAULT NULL COMMENT '实名认证时间',
ADD UNIQUE KEY uk_phone (phone);

-- 创建验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL COMMENT '手机号',
  code VARCHAR(6) NOT NULL COMMENT '验证码',
  type VARCHAR(20) NOT NULL COMMENT '类型: register, bind, login',
  used TINYINT(1) DEFAULT 0 COMMENT '是否已使用',
  expires_at DATETIME NOT NULL COMMENT '过期时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='验证码表';
