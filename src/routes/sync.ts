import express from 'express';
import { fetchAndUpdateProducts } from '@/services/productService';

const router = express.Router();

router.get('/sync-products', async (req, res) => {
  try {
    await fetchAndUpdateProducts();
    res.status(200).json({ message: 'Product sync completed.' });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync products.' });
  }
});

export default router;
