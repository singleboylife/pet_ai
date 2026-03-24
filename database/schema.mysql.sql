-- ============================================================
--  宠医宝 MySQL 数据库 Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id               INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(50)     UNIQUE NOT NULL,
  password         VARCHAR(255)    NOT NULL,
  nickname         VARCHAR(50)     DEFAULT '',
  avatar           TEXT,
  bio              TEXT,
  phone            VARCHAR(20)     DEFAULT '',
  email            VARCHAR(100)    DEFAULT '',
  is_member        TINYINT(1)      DEFAULT 0,
  member_expire    DATETIME        DEFAULT NULL,
  points           INT             DEFAULT 0,
  wallet_balance   DECIMAL(10,2)   DEFAULT 0.00,
  created_at       DATETIME        DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS friendships (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  requester_id INT UNSIGNED NOT NULL,
  addressee_id INT UNSIGNED NOT NULL,
  status       VARCHAR(20)  DEFAULT 'pending',
  created_at   DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_friendship (requester_id, addressee_id),
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (addressee_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS posts (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED NOT NULL,
  content        TEXT         NOT NULL,
  images         JSON,
  category       VARCHAR(50)  DEFAULT '',
  likes_count    INT          DEFAULT 0,
  comments_count INT          DEFAULT 0,
  is_hot         TINYINT(1)   DEFAULT 0,
  created_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_likes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_like (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_comments (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  content    TEXT         NOT NULL,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS baike_entries (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title         VARCHAR(200) NOT NULL,
  preview_image TEXT,
  page_path     TEXT,
  description   TEXT,
  category      VARCHAR(100) DEFAULT '',
  tags          JSON,
  view_count    INT          DEFAULT 0,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
  id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(200)  NOT NULL,
  description    TEXT,
  price          DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) DEFAULT 0,
  stock          INT           DEFAULT 0,
  image          TEXT,
  category       VARCHAR(100)  DEFAULT '',
  sales          INT           DEFAULT 0,
  is_active      TINYINT(1)    DEFAULT 1,
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cart_items (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity   INT          DEFAULT 1,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cart (user_id, product_id),
  FOREIGN KEY (user_id)    REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  order_no       VARCHAR(50)   UNIQUE NOT NULL,
  user_id        INT UNSIGNED  NOT NULL,
  total_amount   DECIMAL(10,2) NOT NULL,
  status         VARCHAR(20)   DEFAULT 'pending',
  address        JSON,
  items          JSON,
  payment_method VARCHAR(50)   DEFAULT '',
  points_used    INT           DEFAULT 0,
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED  NOT NULL,
  amount        DECIMAL(10,2) NOT NULL,
  type          VARCHAR(20)   NOT NULL,
  description   TEXT,
  balance_after DECIMAL(10,2) NOT NULL,
  created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS points_transactions (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  points        INT          NOT NULL,
  type          VARCHAR(20)  NOT NULL,
  description   TEXT,
  balance_after INT          NOT NULL,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS member_plans (
  id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name           VARCHAR(100)  NOT NULL,
  duration       INT           NOT NULL,
  price          DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2) DEFAULT 0,
  features       JSON,
  is_active      TINYINT(1)    DEFAULT 1,
  sort_order     INT           DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS member_subscriptions (
  id             INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id        INT UNSIGNED  NOT NULL,
  plan_id        INT UNSIGNED  NOT NULL,
  start_date     DATETIME      NOT NULL,
  end_date       DATETIME      NOT NULL,
  payment_amount DECIMAL(10,2) NOT NULL,
  created_at     DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (plan_id) REFERENCES member_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS consultations (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  type       VARCHAR(50)  NOT NULL,
  title      VARCHAR(200) DEFAULT '',
  messages   JSON,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  type       VARCHAR(50)  NOT NULL,
  content    TEXT         NOT NULL,
  is_read    TINYINT(1)   DEFAULT 0,
  ref_id     INT          DEFAULT 0,
  ref_type   VARCHAR(50)  DEFAULT '',
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS checkins (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  checkin_date  DATE         NOT NULL,
  points_earned INT          DEFAULT 10,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_checkin (user_id, checkin_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS addresses (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(50)  NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  province   VARCHAR(50)  DEFAULT '',
  city       VARCHAR(50)  DEFAULT '',
  district   VARCHAR(50)  DEFAULT '',
  detail     TEXT         NOT NULL,
  is_default TINYINT(1)   DEFAULT 0,
  created_at DATETIME     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 预置数据 ───────────────────────────────────────────────

INSERT IGNORE INTO member_plans (id, name, duration, price, original_price, features, sort_order) VALUES
(1, '月度会员', 30,  9.9,  19.9, '["每日无限次AI咨询","专属会员徽章","商城9折优惠","每日双倍积分"]', 1),
(2, '季度会员', 90,  24.9, 49.9, '["每日无限次AI咨询","专属会员徽章","商城85折优惠","每日三倍积分","专属客服"]', 2),
(3, '年度会员', 365, 79.9, 199.9,'["每日无限次AI咨询","专属会员徽章","商城8折优惠","每日五倍积分","专属客服","生日特权"]', 3);

INSERT IGNORE INTO baike_entries (id, title, description, category, preview_image, page_path, tags) VALUES
(1, '猫咪日常护理', '了解猫咪的日常清洁、梳毛、洗澡等护理知识，保持猫咪健康美丽。', '猫咪护理', 'baike/preview/cat-care.jpg', 'baike/page/cat-care.html', '["猫咪","护理","清洁"]'),
(2, '犬细小病毒', '犬细小病毒病是高度接触性传染病，了解预防和早期识别方法。', '犬类疾病', 'baike/preview/parvovirus.jpg', 'baike/page/parvovirus.html', '["狗狗","疾病","传染病"]'),
(3, '宠物营养学基础', '了解宠物所需基本营养素，为宠物提供科学均衡的饮食。', '营养健康', 'baike/preview/nutrition.jpg', 'baike/page/nutrition.html', '["营养","饮食","健康"]'),
(4, '猫咪疫苗接种指南', '猫咪疫苗接种时间表和注意事项，保护爱猫免受常见疾病侵害。', '疫苗防疫', 'baike/preview/vaccine.jpg', 'baike/page/vaccine.html', '["疫苗","预防","猫咪"]'),
(5, '狗狗行为解读', '了解狗狗各种行为背后的含义，增进人宠之间的深度沟通。', '行为习性', 'baike/preview/dog-behavior.jpg', 'baike/page/dog-behavior.html', '["狗狗","行为","沟通"]'),
(6, '猫咪常见皮肤病', '介绍猫咪真菌感染、螨虫、过敏等皮肤病的症状与处理。', '疾病预防', 'baike/preview/skin-disease.jpg', 'baike/page/skin-disease.html', '["猫咪","皮肤病","寄生虫"]'),
(7, '宠物绝育指南', '宠物绝育手术的最佳时机、术前准备和术后护理完整指南。', '医疗护理', 'baike/preview/neuter.jpg', 'baike/page/neuter.html', '["绝育","手术","护理"]'),
(8, '幼犬喂养手册', '从出生到6个月，幼犬各阶段的喂养要点和营养需求。', '营养健康', 'baike/preview/puppy-feed.jpg', 'baike/page/puppy-feed.html', '["幼犬","喂养","成长"]');

INSERT IGNORE INTO products (id, name, description, price, original_price, stock, image, category) VALUES
(1, '宠物营养膏（猫狗通用）', '补充维生素和矿物质，增强免疫力，适合猫狗日常保健', 29.9,  49.9,  100, '', '营养保健'),
(2, '宠物体外驱虫滴剂', '预防跳蚤、蜱虫等体外寄生虫，安全有效，适合1.5kg以上', 59.9,  89.9,  50,  '', '驱虫防病'),
(3, '天然高蛋白猫粮 1kg', '优质蛋白质配方，无谷物，适合成年猫日常主食', 89.9,  119.9, 200, '', '猫粮主食'),
(4, '宠物电子体温计', '5秒快速测量，精确度±0.1°C，配有宠物专用软头', 39.9,  59.9,  80,  '', '医疗器械'),
(5, '犬用洁齿磨牙玩具', '天然橡胶材质，清洁牙齿同时锻炼咬合，适合中大型犬', 35.9,  55.9,  150, '', '玩具用品'),
(6, '宠物关节保健片', '含氨基葡萄糖，保护关节软骨，适合老年犬猫及大型犬', 79.9,  129.9, 60,  '', '营养保健'),
(7, '猫咪化毛膏', '帮助猫咪排出胃内毛球，防止毛球堵塞，金枪鱼口味', 25.9,  39.9,  120, '', '营养保健'),
(8, '宠物耳道清洁液', '温和配方，有效清洁耳道，预防耳道炎症', 22.9,  35.9,  90,  '', '日常护理');
