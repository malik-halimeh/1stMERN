import { Router } from 'express';
import { getProductRecommendations } from '../controllers/recommendation.js';

const router = Router();

// Retrieve product recommendations (public endpoint)
router.get('/', getProductRecommendations);

export default router;
