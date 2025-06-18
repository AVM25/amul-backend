import axios from 'axios';
import { Product } from '@/models/Product';
import { AmulProductData } from '@/types';
import { notifySubscribers } from './emailService';

// ✅ Amul API URL
const AMUL_API_URL = 'https://shop.amul.com/api/1/entity/ms.products?fields[name]=1&fields[brand]=1&fields[categories]=1&fields[alias]=1&fields[sku]=1&fields[price]=1&fields[images]=1&fields[available]=1&fields[inventory_quantity]=1&limit=32&filters[0][field]=categories&filters[0][value][0]=protein&filters[0][operator]=in&filters[0][original]=1&substore=66506000c8f2d6e221b9193a';

export const fetchAndUpdateProducts = async (): Promise<void> => {
  try {
    console.log('🔄 Fetching products from Amul API...');
    const response = await axios.get<{ data: AmulProductData[] }>(AMUL_API_URL);
    const products = response.data.data;

    console.log('🧪 Fetched Amul Products:', products.length);

    let updatedCount = 0;
    let addedCount = 0;
    let restockedCount = 0;

    for (const product of products) {
      console.log(`🔁 Checking product: ${product.name} (Qty: ${product.inventory_quantity})`);
      const existing = await Product.findOne({ productId: product._id });

      if (existing) {
        const wasOutOfStock = existing.inventoryQuantity === 0;
        const nowInStock = product.inventory_quantity > 0;

        if (wasOutOfStock && nowInStock) {
          console.log(`📦 Restocked: ${product.name}`);
          await notifySubscribers(existing, product);
          restockedCount++;
        }

        await Product.findOneAndUpdate(
          { productId: product._id },
          {
            name: product.name,
            price: product.price,
            inventoryQuantity: product.inventory_quantity,
            lastChecked: new Date(),
            wasOutOfStock: product.inventory_quantity === 0,
            isActive: true,
            brand: product.brand,
            image: product.images?.[0]?.image
              ? `https://shop.amul.com/s/62fa94df8c13af2e242eba16/${product.images[0].image}`
              : undefined,
          }
        );

        updatedCount++;
      } else {
        const newProduct = new Product({
          productId: product._id,
          name: product.name,
          alias: product.alias,
          price: product.price,
          inventoryQuantity: product.inventory_quantity,
          lastChecked: new Date(),
          wasOutOfStock: product.inventory_quantity === 0,
          isActive: true,
          brand: product.brand,
          image: product.images?.[0]?.image
            ? `https://shop.amul.com/s/62fa94df8c13af2e242eba16/${product.images[0].image}`
            : undefined,
        });

        await newProduct.save();
        addedCount++;
        console.log(`➕ Added new product: ${product.name}`);
      }
    }

    console.log(`✅ Sync complete: Updated ${updatedCount}, Added ${addedCount}, Restocked ${restockedCount}`);
  } catch (error) {
    console.error('❌ Failed to fetch/update products:', error);
    throw error;
  }
};
