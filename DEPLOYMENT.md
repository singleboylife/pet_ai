# 宠医宝 - 完整部署教程

> 服务器地址：`192.168.43.181`（局域网）
> 后端端口：`3000`
> 前端：HBuilderX 4.87 + UniApp Vue3
> 基础库：2.32.3

---

## 一、环境准备

### 1. 安装 Node.js（v18+）
```bash
# 下载并安装 Node.js LTS: https://nodejs.org
# 验证安装
node -v   # >= 18.0.0
npm -v
```

### 2. 安装 HBuilderX
- 下载地址：https://www.dcloud.io/hbuilderx.html
- 版本：4.87（已安装）

---

## 二、后端部署

### 1. 进入后端目录并安装依赖
n```bash
cd d:/desktop/aipet/backend
npm install
```

如果 `better-sqlite3` 编译失败，执行：
```bash
npm install -g windows-build-tools   # 仅 Windows 需要（管理员运行）
npm rebuild better-sqlite3
```

### 2. 配置环境变量

编辑 `d:/desktop/aipet/backend/.env`：

```env
PORT=3000
HOST=0.0.0.0

# JWT（必须修改成强密钥）
JWT_SECRET=换成你自己的超长随机字符串

# DeepSeek API（在 https://platform.deepseek.com 申请）
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_MODEL=deepseek-chat

# 腾讯云 COS（在腾讯云 > 访问管理 > API密钥管理 获取）
COS_SECRET_ID=your_secret_id
COS_SECRET_KEY=your_secret_key
COS_BUCKET=linbt95-1407297692
COS_REGION=ap-guangzhou
COS_BASE_URL=https://linbt95-1407297692.cos.ap-guangzhou.myqcloud.com
```

### 3. 启动后端服务

```bash
# 开发模式（自动重启）
cd d:/desktop/aipet/backend
npm run dev

# 生产模式
npm start
```

启动成功后控制台显示：
```
🐾 宠医宝后端服务已启动
   本地访问: http://127.0.0.1:3000
   局域网访问: http://192.168.43.181:3000
[DB] SQLite 数据库已就绪: ...pet_ai.db
```

### 4. 验证后端接口

打开浏览器或 Postman：
```
POST http://192.168.43.181:3000/api/auth/register
Content-Type: application/json
Body: {"username":"test","password":"123456","nickname":"测试用户"}
```

---

## 三、COS 云存储配置

### 1. 腾讯云 COS 控制台操作
1. 登录 https://console.cloud.tencent.com/cos
2. 进入存储桶 `linbt95-1407297692`
3. 确认以下目录存在（不存在则手动创建）：
   - `baike/page/`     — 百科 HTML 详情页
   - `baike/preview/`  — 百科缩略图
   - `user/avatars/`   — 用户头像
   - `user/posts/`     — 帖子图片
   - `user/hot/`       — 热门帖子资源

4. **设置跨域规则（CORS）**：
   - 来源域名：`*`
   - 操作方法：`GET, POST, PUT, DELETE, HEAD`
   - Allow Headers：`*`

5. **设置存储桶权限**：
   - 公共读 / 私有写（推荐）

### 2. 上传百科内容
将您的百科 HTML 文件上传到 `baike/page/` 目录，
预览图上传到 `baike/preview/` 目录。

然后在数据库中通过后台 API 或直接修改 SQLite 添加词条记录。

### 3. 通过后端 API 添加百科词条（推荐）
```bash
# 需先实现后台管理接口，或直接用 DB Browser for SQLite 工具操作数据库
# 数据库文件位置：d:/desktop/aipet/backend/database/pet_ai.db
```

---

## 四、前端部署（HBuilderX）

### 1. 安装 uview-plus

打开 HBuilderX 终端，在 `frontend` 目录下：
```bash
cd d:/desktop/aipet/frontend
npm install
```

或使用 HBuilderX 插件市场安装 uview-plus：
- 搜索 "uview-plus"，安装到项目

### 2. 导入项目到 HBuilderX

1. 打开 HBuilderX
2. 文件 → 导入 → 从本地目录导入
3. 选择 `d:/desktop/aipet/frontend`

### 3. 配置基础库版本

`manifest.json` 已设置，确认微信小程序 `setting.es6 = true`。

### 4. 修改 API 地址

如果服务器 IP 变更，修改以下文件：

`frontend/utils/request.js` 第 7 行：
```javascript
const BASE_URL = 'http://192.168.43.181:3000'
```
`frontend/utils/stream.js` 第 1 行引用同一个 BASE_URL，无需单独修改。

### 5. 添加 TabBar 图标

在 `frontend/static/tabbar/` 目录下放置以下图标文件（PNG，推荐 81×81px）：
- `home.png` / `home-active.png`
- `square.png` / `square-active.png`
- `consult.png` / `consult-active.png`
- `baike.png` / `baike-active.png`
- `profile.png` / `profile-active.png`

可从 https://www.iconfont.cn 下载绿色系列图标。

### 6. 添加 Logo 图片

将您的 Logo 图片命名为 `logo.png` 放到 `frontend/static/` 目录。

### 7. 添加商品占位图

将商品占位图命名为 `product-placeholder.png` 放到 `frontend/static/` 目录。

### 8. 运行调试

**手机 App 调试**：
1. HBuilderX → 运行 → 运行到手机或模拟器
2. 确保手机与电脑在同一局域网（192.168.43.x）

**H5 调试**：
1. HBuilderX → 运行 → 运行到浏览器
2. 注意跨域问题，可以在浏览器设置中允许跨域

**微信小程序调试**：
1. 需要在微信开发者工具中配置服务器合法域名
2. 或开启"不校验合法域名"（开发阶段）
3. manifest.json 中填写 `mp-weixin.appid`

---

## 五、数据库管理

使用 **DB Browser for SQLite** 工具可视化管理数据库：
- 下载：https://sqlitebrowser.org
- 打开文件：`d:/desktop/aipet/backend/database/pet_ai.db`

### 常用操作

**添加百科词条**：
```sql
INSERT INTO baike_entries (title, description, category, preview_image, page_path, tags)
VALUES ('猫咪心脏病', '介绍猫咪常见心脏疾病的症状和预防', '心脏疾病',
        'baike/preview/heart.jpg', 'baike/page/heart.html', '["猫咪","心脏","疾病"]');
```

**查看订单**：
```sql
SELECT * FROM orders ORDER BY created_at DESC;
```

**重置用户密码**：
```sql
-- 使用 bcrypt 哈希 '123456'（需通过后端 API 操作，不建议直接修改）
```

---

## 六、后端接口文档（完整）

### 认证接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/refresh` | 刷新 Token |

### 用户接口（需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/profile` | 获取自己资料 |
| PUT | `/api/user/profile` | 更新资料 |
| POST | `/api/user/upload-avatar` | 上传头像（multipart） |
| GET | `/api/user/:id` | 查看他人资料 |
| GET | `/api/user/notifications/list` | 通知列表 |
| GET | `/api/user/notifications/unread-count` | 未读数 |
| GET | `/api/user/addresses/list` | 地址列表 |
| POST | `/api/user/addresses` | 添加地址 |
| PUT | `/api/user/addresses/:id` | 修改地址 |
| DELETE | `/api/user/addresses/:id` | 删除地址 |

### AI 咨询（需 Token，限速 20次/分钟）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/stream` | 流式 AI 咨询（SSE） |
| GET | `/api/ai/history` | 咨询历史列表 |
| GET | `/api/ai/history/:id` | 咨询详情 |
| DELETE | `/api/ai/history/:id` | 删除记录 |
| POST | `/api/ai/new-session` | 新建会话 |

### 社交接口（需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/social/posts` | 广场动态 |
| POST | `/api/social/posts` | 发布动态（支持图片） |
| DELETE | `/api/social/posts/:id` | 删除动态 |
| GET | `/api/social/posts/:id` | 动态详情 |
| POST | `/api/social/posts/:id/like` | 点赞 |
| DELETE | `/api/social/posts/:id/like` | 取消点赞 |
| GET | `/api/social/posts/:id/comments` | 评论列表 |
| POST | `/api/social/posts/:id/comments` | 发评论 |
| GET | `/api/social/hot` | 热门动态 |
| GET | `/api/social/posts/user/:userId` | 用户动态 |
| GET | `/api/social/friends` | 好友列表 |
| POST | `/api/social/friends/request/:userId` | 发好友申请 |
| PUT | `/api/social/friends/accept/:userId` | 接受申请 |
| DELETE | `/api/social/friends/:userId` | 删除/拒绝好友 |
| GET | `/api/social/friends/requests` | 待处理申请 |
| GET | `/api/social/search/users?keyword=` | 搜索用户 |

### 百科接口（需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/baike/list` | 词条列表（支持分类/随机） |
| GET | `/api/baike/search?q=` | 搜索词条 |
| GET | `/api/baike/categories` | 分类列表 |
| GET | `/api/baike/:id` | 词条详情（浏览量+1） |
| GET | `/api/baike/random/picks` | 随机推荐 |

### 商城接口（需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/mall/products` | 商品列表 |
| GET | `/api/mall/products/:id` | 商品详情 |
| GET | `/api/mall/categories` | 商品分类 |
| GET | `/api/mall/cart` | 购物车 |
| POST | `/api/mall/cart` | 加入购物车 |
| PUT | `/api/mall/cart/:productId` | 更新数量 |
| DELETE | `/api/mall/cart/:productId` | 删除商品 |
| POST | `/api/mall/orders` | 创建订单 |
| GET | `/api/mall/orders` | 我的订单 |
| GET | `/api/mall/orders/:id` | 订单详情 |
| PUT | `/api/mall/orders/:id/cancel` | 取消订单 |

### 钱包接口（需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/wallet/balance` | 余额查询 |
| GET | `/api/wallet/transactions` | 流水记录 |
| POST | `/api/wallet/recharge` | 充值（模拟） |

### 积分接口（需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/points/balance` | 积分余额 |
| GET | `/api/points/transactions` | 积分明细 |
| POST | `/api/points/checkin` | 每日签到 |
| GET | `/api/points/checkin/status` | 签到状态 |
| POST | `/api/points/exchange` | 积分兑换 |

### 会员接口（需 Token）
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/member/plans` | 套餐列表 |
| GET | `/api/member/status` | 会员状态 |
| POST | `/api/member/subscribe` | 订购会员 |
| GET | `/api/member/history` | 订购历史 |

---

## 七、积分规则说明

| 行为 | 积分 | 说明 |
|------|------|------|
| 新用户注册 | +50 | 一次性赠送 |
| 每日签到 | +10 | 基础积分 |
| 连续签到3天 | +10 | 额外奖励 |
| 连续签到7天 | +20 | 额外奖励 |
| 会员签到 | ×2 倍 | 月度会员 |
| 发布动态 | +5 | 每次 |
| AI 咨询 | +2 | 每次 |
| 商城购物 | +1/10元 | 消费比例 |
| 充值钱包 | +1/10元 | 充值比例 |
| 积分兑换 | 100分=1元 | 最少100分 |

---

## 八、常见问题排查

### Q: 后端启动报错 "Cannot find module 'better-sqlite3'"
```bash
cd backend
npm install better-sqlite3 --build-from-source
```

### Q: 前端连接不到后端
- 确认手机和电脑在同一 WiFi
- 检查 Windows 防火墙是否放行 3000 端口：
  ```
  控制面板 → Windows Defender防火墙 → 高级设置 → 入站规则 → 新建规则 → 端口 3000
  ```
- 验证：手机浏览器访问 `http://192.168.43.181:3000/api/auth/login`

### Q: DeepSeek 流式输出不工作
- 检查 `.env` 中 `DEEPSEEK_API_KEY` 是否正确
- 确认账户余额充足
- App 端需要 UniApp 基础库 >= 2.32.3

### Q: COS 图片上传失败
- 检查 `COS_SECRET_ID` 和 `COS_SECRET_KEY` 是否正确
- 确认 COS 存储桶跨域规则已设置
- 检查密钥是否有 COS 写入权限

### Q: 微信小程序提示"非法域名"
- 在微信公众平台配置服务器域名白名单
- 或开发阶段在微信开发者工具中勾选"不校验合法域名"

---

## 九、上线前检查清单

- [ ] 修改 `JWT_SECRET` 为强密钥
- [ ] 填写真实的 `DEEPSEEK_API_KEY`
- [ ] 填写正确的 COS 密钥
- [ ] 上传 Logo 图片 (`static/logo.png`)
- [ ] 上传 TabBar 图标 (`static/tabbar/`)
- [ ] 上传商品占位图 (`static/product-placeholder.png`)
- [ ] 在 COS 创建必要目录
- [ ] 添加真实百科词条
- [ ] 添加真实商品数据
- [ ] 测试完整用户流程（注册→登录→发帖→AI咨询→购买）

---

## 十、目录结构总览

```
d:/desktop/aipet/
├── backend/
│   ├── .env                    # 环境变量配置（必须填写）
│   ├── package.json
│   ├── server.js               # 入口文件
│   ├── database/
│   │   ├── db.js               # SQLite 连接
│   │   ├── schema.sql          # 建表语句
│   │   └── pet_ai.db           # 数据库文件（运行后自动生成）
│   ├── middleware/
│   │   └── auth.js             # JWT 鉴权中间件
│   ├── routes/
│   │   ├── auth.js             # 注册/登录
│   │   ├── user.js             # 用户资料/通知/地址
│   │   ├── ai.js               # DeepSeek 流式 AI
│   │   ├── social.js           # 广场/好友
│   │   ├── baike.js            # 百科
│   │   ├── mall.js             # 商城/购物车/订单
│   │   ├── wallet.js           # 钱包
│   │   ├── points.js           # 积分/签到
│   │   └── member.js           # 会员
│   └── utils/
│       ├── cos.js              # COS 上传工具
│       └── deepseek.js         # DeepSeek 客户端
└── frontend/
    ├── App.vue
    ├── main.js
    ├── pages.json
    ├── manifest.json
    ├── uni.scss
    ├── package.json
    ├── utils/
    │   ├── request.js          # HTTP 请求封装
    │   ├── stream.js           # DeepSeek 流式接收
    │   └── auth.js             # (可扩展)
    ├── stores/
    │   └── user.js             # Pinia 用户状态
    ├── components/
    │   ├── PostCard/           # 动态帖子卡片
    │   └── BaikeCard/          # 百科词条卡片
    ├── pages/
    │   ├── index/index.vue     # Tab1: 首页
    │   ├── square/             # Tab2: 广场
    │   ├── consult/            # Tab3: AI咨询
    │   ├── baike/              # Tab4: 百科
    │   ├── profile/            # Tab5: 我的
    │   ├── login/
    │   ├── register/
    │   ├── friends/
    │   ├── mall/
    │   ├── wallet/
    │   ├── points/
    │   ├── member/
    │   └── user/
    └── static/
        ├── logo.png            # 应用 Logo（需手动添加）
        ├── product-placeholder.png
        └── tabbar/             # Tab 图标（需手动添加）
```
