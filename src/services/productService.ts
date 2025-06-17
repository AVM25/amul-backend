import axios from 'axios';
import { Product } from '@/models/Product';
import { AmulProductData } from '@/types';
import { notifySubscribers } from './emailService';

const AMUL_API_URL = 'https://shop.amul.com/api/1/entity/ms.products?...'; // keep as-is

export const fetchAndUpdateProducts = async (): Promise<void> => {
  try {
    console.log('🔄 Fetching products from Amul API...');
    const response = await axios.get<{ data: AmulProductData[] }>(AMUL_API_URL);
    const products: AmulProductData[] = response.data.data;

    let updatedCount = 0;
    let addedCount = 0;
    let restockedCount = 0;

    for (const productData of products) {
      try {
        const existingProduct = await Product.findOne({ productId: productData._id });

        if (existingProduct) {
          const wasOutOfStock = existingProduct.inventoryQuantity === 0;
          const nowInStock = productData.inventory_quantity > 0;

          if (wasOutOfStock && nowInStock) {
            console.log(`📦 Product back in stock: ${productData.name}`);
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
              isActive: true
            }
          );
          console.log(`🔁 Updated product: ${productData.name}`);
          updatedCount++;

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
            isActive: true
          });

          await newProduct.save();
          console.log(`➕ Saved new product: ${productData.name}`);
          addedCount++;
        }
      } catch (innerError) {
        console.error(`❌ Failed processing product ${productData.name}:`, innerError);
      }
    }

    console.log(`✅ Products sync completed - Updated: ${updatedCount}, Added: ${addedCount}, Restocked: ${restockedCount}`);
  } catch (error) {
    console.error('❌ Error fetching products:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};
