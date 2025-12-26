// server/index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// 中间件
app.use(express.json());
app.use(cors());

// 调试中间件：打印所有收到的请求
app.use((req, res, next) => {
  console.log(`[请求到达] ${req.method} ${req.url}`);
  next();
});

// 1. 连接数据库
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Success!'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 2. 定义产品模型
const ProductSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  stock: Number,
  lastUpdated: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', ProductSchema);

// 3. 核心 API 路由 (绝对不能少！)

// GET: 获取所有产品
app.get('/api/products', async (req, res) => {
  console.log("正在读取数据库...");
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST: 添加新产品
app.post('/api/products', async (req, res) => {
  console.log("正在保存新产品:", req.body);
  try {
    const newProduct = new Product(req.body);
    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE: 删除产品
app.delete('/api/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. 启动服务器 (默认 5001)
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));