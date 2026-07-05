import { Router } from 'express';
import multer from 'multer';
import productController from '../../../modules/master/controllers/product.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/products/getCategories', productController.getCategories.bind(productController));
router.post('/products/getBrands', productController.getBrands.bind(productController));
router.post('/products/getUOM', productController.getUOM.bind(productController));
router.post('/products/getProducts', productController.getProducts.bind(productController));
router.post('/products/getProductDetails', productController.getProductDetails.bind(productController));
router.post('/products/getProductMedia', productController.getProductMedia.bind(productController));
router.post('/products/getProductAttributes', productController.getProductAttributes.bind(productController));
router.post('/products/uploadMedia', upload.single('media'), productController.uploadMedia.bind(productController));
router.post('/products/createProduct', productController.createProduct.bind(productController));

export default router;
