import axios from 'axios';
import { Product } from '@/models/Product';
import { AmulProductData } from '@/types';
import { notifySubscribers } from './emailService';

const AMUL_API_URL = 'https://shop.amul.com/api/1/entity/ms.products?fields[name]=1&fields[brand]=1&fields[categories]=1&fields[collections]=1&fields[alias]=1&fields[sku]=1&fields[price]=1&fields[compare_price]=1&fields[original_price]=1&fields[images]=1&fields[metafields]=1&fields[discounts]=1&fields[catalog_only]=1&fields[is_catalog]=1&fields[seller]=1&fields[available]=1&fields[inventory_quantity]=1&fields[net_quantity]=1&fields[num_reviews]=1&fields[avg_rating]=1&fields[inventory_low_stock_quantity]=1&fields[inventory_allow_out_of_stock]=1&fields[default_variant]=1&fields[variants]=1&fields[lp_seller_ids]=1&filters[0][field]=categories&filters[0][value][0]=protein&filters[0][operator]=in&filters[0][original]=1&facets=true&facetgroup=default_category_facet&limit=32&total=1&start=0&cdc=1m&substore=66506000c8f2d6e221b9193a';

export const fetchAndUpdateProducts = async (): Promise<void> => {
  try {
    console.log('🔄 Fetching products from Amul API...');
    const response = await axios.get<{ data: AmulProductData[] }>(AMUL_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:139.0) Gecko/20100101 Firefox/139.0',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://shop.amul.com/en/browse/protein',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': '_cfuvid=oFu4q07yxwIVzoRg5Y6frrceVMxQnirXppAZThE4ZOw-1745737037868-0.0.1.1-604800000; jsessionid=s%3AFr6HVUyQDQg%2B%2BIKPn4kSBa5n.s5tL5uqoOV%2B0p691WrO4etU7s5erp7KlC7aMDOsf5bQ; __cf_bm=xoSPrAA1ZDI0QI1zm06B3qJj721gAE3eJyWCBhhFQvo-1750167798-1.0.1.1-xe6HRVcNLpI.gS47n7zyO2jpmTzVEVIbGln2YuMAmHACQwHwI34lZuAYBC.etnXXd28EmVo1NKyinm3poWwJ8kfQWdZEURJhueEcDBdbPS0',
      },
    });

    console.log('🧪 Full Amul API Response:', JSON.stringify(response.data, null, 2));
    const products: AmulProductData[] = response.data.data;
    console.log("🧪 Amul Products Response Sample:", JSON.stringify(products.slice(0, 1), null, 2));

    let updatedCount = 0;
    let addedCount = 0;
    let restockedCount = 0;

    for (const productData of products) {
      const existingProduct = await Product.findOne({ productId: productData._id });

      if (existingProduct) {
        const wasOutOfStock = existingProduct.inventoryQuantity === 0;
        const nowInStock = productData.inventory_quantity > 0;

        if (wasOutOfStock && nowInStock) {
          console.log(`📦 Product ${productData.name} is back in stock!`);
          await notifySubscribers(existingProduct, productData);
          restockedCount++;
        }

        await Product.findOneAndUpdate(
          { productId: productData._id },
          {
            inventoryQuantity: productData.inventory_quantity,
            lastChecked: new Date(),
            wasOutOfStock: productData.inventory_quantity === 0,
            price: productData.price,
            name: productData.name,
            image: productData.images?.[0]?.image
              ? `https://shop.amul.com/s/62fa94df8c13af2e242eba16/${productData.images[0].image}`
              : undefined,
            brand: productData.brand,
            isActive: true,
          }
        );
        updatedCount++;
        console.log(`🔁 Updated product: ${productData.name}`);
      } else {
        const newProduct = new Product({
          productId: productData._id,
          name: productData.name,
          alias: productData.alias,
          price: productData.price,
          inventoryQuantity: productData.inventory_quantity,
          image: productData.images?.[0]?.image
            ? `https://shop.amul.com/s/62fa94df8c13af2e242eba16/${productData.images[0].image}`
            : undefined,
          brand: productData.brand,
          wasOutOfStock: productData.inventory_quantity === 0,
          isActive: true,
          lastChecked: new Date(),
        });
        await newProduct.save();
        addedCount++;
        console.log(`➕ Added new product: ${productData.name}`);
      }
    }

    console.log(`✅ Products sync completed - Updated: ${updatedCount}, Added: ${addedCount}, Restocked: ${restockedCount}`);
  } catch (error) {
    console.error('❌ Error fetching products:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};
