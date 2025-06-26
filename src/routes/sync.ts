import express from 'express';
import { fetchAndUpdateProducts } from '@/services/productService';

const router = express.Router();

router.get('/sync-products', async (req, res) => {
  try {
    await fetchAndUpdateProducts();
    res.json({ success: true, message: 'Products synced' });
  } catch (error) {
    console.error('❌ Error syncing products via /api/sync-products:', error);
    res.status(500).json({ success: false, error: 'Failed to sync products' });
  }
});

export default router;
