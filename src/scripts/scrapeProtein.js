const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URL = process.env.MONGODB_URL;

const ProductSchema = new mongoose.Schema({
  productId: String,
  name: String,
  price: String,
  image: String,
  inStock: Boolean,
});

const Product = mongoose.model('Product', ProductSchema);

async function scrapeAndSaveProducts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB');

    const url = 'https://shop.amul.com/en/browse/protein';
    console.log(`🌐 Fetching products from ${url}`);
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const products = [];

    $('.product').each((_, el) => {
      const name = $(el).find('.product-name a').text().trim();
      const price = $(el).find('.price-box .price').first().text().trim();
      const image = $(el).find('.product-image img').attr('src');
      const productId = $(el).attr('data-product-id') || name.replace(/\s+/g, '-').toLowerCase();

      const inStock = !$(el).find('.stock.unavailable').length;

      products.push({
        productId,
        name,
        price,
        image: image?.startsWith('http') ? image : 'https://shop.amul.com' + image,
        inStock,
      });
    });

    console.log(`🧺 Found ${products.length} products. Saving to DB...`);

    for (const product of products) {
      await Product.findOneAndUpdate(
        { productId: product.productId },
        product,
        { upsert: true, new: true }
      );
    }

    console.log('✅ Products saved/updated successfully!');
    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
    mongoose.disconnect();
  }
}

scrapeAndSaveProducts();
