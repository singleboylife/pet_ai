# 支付与订单管理功能说明

## 📦 已完成功能

### 1. 虚拟支付系统

**功能说明**：
- 支持支付宝和微信两种支付方式（虚拟模拟）
- 用户发起充值后，3秒自动完成支付
- 自动更新钱包余额和赠送积分

**API 接口**：

#### 创建支付订单
```
POST /api/payment/create
Headers: Authorization: Bearer {token}
Body: {
  "amount": 100,
  "payment_method": "alipay" // 或 "wechat"
}
```

#### 查询支付状态
```
GET /api/payment/query/:order_no
Headers: Authorization: Bearer {token}
```

#### 支付订单列表
```
GET /api/payment/orders?page=1&limit=20&status=paid
Headers: Authorization: Bearer {token}
```

---

### 2. 收货地址管理

**已有功能**（在 `/api/user` 路由下）：

#### 获取地址列表
```
GET /api/user/addresses/list
Headers: Authorization: Bearer {token}
```

#### 新增地址
```
POST /api/user/addresses
Headers: Authorization: Bearer {token}
Body: {
  "name": "张三",
  "phone": "13800138000",
  "province": "广东省",
  "city": "广州市",
  "district": "天河区",
  "detail": "XX路XX号",
  "is_default": 1  // 1=默认地址, 0=普通地址
}
```

#### 修改地址
```
PUT /api/user/addresses/:id
Headers: Authorization: Bearer {token}
Body: { 同新增 }
```

#### 删除地址
```
DELETE /api/user/addresses/:id
Headers: Authorization: Bearer {token}
```

---

### 3. 订单流程

**下单流程**：
1. 用户选择商品加入购物车
2. 点击结算，选择收货地址
3. 选择支付方式（钱包支付）
4. 确认下单，扣除余额
5. 订单状态变为 `paid`（已支付）

**订单状态流转**：
```
pending (待支付) 
  ↓
paid (已支付) 
  ↓
shipped (已发货) 
  ↓
completed (已完成)
```

---

### 4. 管理员订单管理

**管理后台地址**：
```
http://129.204.226.96:3000/admin-orders.html
```

**功能列表**：
- ✅ 查看所有订单列表
- ✅ 按状态筛选订单
- ✅ 搜索订单（订单号/用户名）
- ✅ 查看订单详情（商品、收货地址）
- ✅ 订单发货（填写物流公司和单号）
- ✅ 订单统计（总订单数、待发货、已发货、总收入）

**管理员 API 接口**：

#### 获取订单列表
```
GET /api/admin/orders?page=1&limit=20&status=paid&keyword=PET
Headers: Authorization: Bearer {admin_token}
```

#### 获取订单详情
```
GET /api/admin/orders/:id
Headers: Authorization: Bearer {admin_token}
```

#### 订单发货
```
PUT /api/admin/orders/:id/ship
Headers: Authorization: Bearer {admin_token}
Body: {
  "shipping_company": "顺丰速运",
  "tracking_number": "SF1234567890"
}
```

#### 更新订单状态
```
PUT /api/admin/orders/:id/status
Headers: Authorization: Bearer {admin_token}
Body: {
  "status": "completed"
}
```

#### 订单统计
```
GET /api/admin/orders/stats/summary
Headers: Authorization: Bearer {admin_token}
```

---

## 🗄️ 数据库变更

需要执行以下 SQL 脚本：

```bash
cd d:\desktop\aipet\frontend3\backend\backend\database
mysql -u root -p pet_mysql < add_payment_orders.sql
```

**新增表**：
- `payment_orders` - 支付订单表

**新增字段**（orders 表）：
- `shipping_company` - 物流公司
- `tracking_number` - 物流单号
- `shipped_at` - 发货时间
- `received_at` - 收货时间

---

## 🚀 使用流程

### 用户端流程

1. **充值钱包**
   ```javascript
   // 前端调用
   const res = await request({
     url: '/api/payment/create',
     method: 'POST',
     data: { amount: 100, payment_method: 'alipay' }
   })
   
   // 3秒后查询支付状态
   setTimeout(async () => {
     const status = await request({
       url: `/api/payment/query/${res.data.order_no}`
     })
     if (status.data.status === 'paid') {
       // 支付成功，刷新余额
     }
   }, 3000)
   ```

2. **管理收货地址**
   - 首次下单时添加地址
   - 可设置默认地址
   - 下次下单自动选择默认地址

3. **下单购物**
   ```javascript
   const res = await request({
     url: '/api/mall/orders',
     method: 'POST',
     data: {
       items: [{ product_id: 1, quantity: 2 }],
       address_id: 1,
       payment_method: 'wallet',
       use_points: 0
     }
   })
   ```

### 管理员端流程

1. **访问管理后台**
   - 打开 `http://129.204.226.96:3000/admin-orders.html`
   - 输入管理员 Token（首次访问）

2. **查看订单**
   - 查看所有订单列表
   - 筛选"已支付"状态的订单

3. **发货操作**
   - 点击"发货"按钮
   - 选择物流公司
   - 填写物流单号
   - 确认发货

4. **用户收到通知**
   - 系统自动发送通知给用户
   - 用户可在 APP 中查看物流信息

---

## 📝 注意事项

1. **虚拟支付说明**
   - 当前为虚拟支付，3秒自动完成
   - 等企业资质下来后，替换为真实支付接口
   - 只需修改 `/api/payment/create` 接口逻辑

2. **管理员权限**
   - 需要使用 `role='admin'` 的账号 Token
   - 默认管理员账号：`admin` / `admin123`

3. **地址管理优化建议**
   - 前端可集成地区选择器（省市区三级联动）
   - 参考淘宝的地址选择组件

4. **物流追踪**
   - 可对接第三方物流查询 API（如快递100）
   - 用户可实时查看物流状态

---

## 🔄 后续升级计划

### 接入真实支付（企业资质下来后）

1. **支付宝接入**
   - 申请支付宝商户号
   - 配置应用私钥和公钥
   - 修改 `/routes/payment.js` 接口
   - 实现异步回调验证

2. **微信支付接入**
   - 申请微信商户号
   - 配置 API 证书
   - 实现 V3 版本接口
   - 处理支付回调

3. **HTTPS 配置**
   - 申请 SSL 证书
   - 配置 Nginx 反向代理
   - 更新回调地址为 HTTPS

---

## 📞 技术支持

如有问题，请检查：
1. 数据库是否执行了 SQL 脚本
2. 后端服务是否重启
3. Token 是否有效
4. 管理员权限是否正确

---

**创建时间**: 2026-04-13
**版本**: v1.0
