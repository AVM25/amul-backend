import { Product } from '@/models/Product';
import { notifySubscribers } from './emailService';

interface FetchedProduct {
  _id: string;
  name: string;
  alias?: string;
  price: number;
  inventory_quantity: number;
  images?: { image: string }[];
  brand?: string;
}

export const fetchAndUpdateProducts = async (): Promise<void> => {
  try {
    console.log('🔄 Launching Puppeteer...');
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto('https://shop.amul.com/en/browse/protein', {
      waitUntil: 'networkidle2',
    });

    // Wait for products to load in window.__INITIAL_STATE__
    const productsData = await page.evaluate(() => {
      // @ts-ignore
      const state = window.__INITIAL_STATE__;
      const entities = state?.entities?.['ms.products'];
      return entities ? Object.values(entities) : [];
    });

    await browser.close();

    if (!productsData || !Array.isArray(productsData)) {
      console.warn('⚠️ No products found in Puppeteer scrape');
      return;
    }

    let updatedCount = 0;
    let addedCount = 0;
    let restockedCount = 0;

    for (const productData of productsData as FetchedProduct[]) {
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

    console.log(
      `✅ Products sync completed - Updated: ${updatedCount}, Added: ${addedCount}, Restocked: ${restockedCount}`
    );
  } catch (error) {
    console.error('❌ Error in Puppeteer product fetch:', error);
    throw error;
  }
};
