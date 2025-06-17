import axios from 'axios';
import cheerio from 'cheerio';
import mongoose from 'mongoose';
import Product from '../models/product';

const scrapeProtein = async () => {
  try {
    console.log('🔄 Scraping Amul Protein products...');
    const url = 'https://shop.amul.com/en/browse/protein';
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const products: any[] = [];

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

    console.log(`🧺 Found ${products.length} products. Saving...`);

    for (const product of products) {
      await Product.findOneAndUpdate(
        { productId: product.productId },
        product,
        { upsert: true, new: true }
      );
    }

    console.log('✅ Products saved/updated!');
  } catch (err) {
    console.error('❌ Scraping error:', err);
  }
};

export default scrapeProtein;
