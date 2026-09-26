import { Router } from 'express';
import multer from 'multer';
import productController from '../../../modules/master/controllers/product.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/products/createCategory', productController.createCategory.bind(productController));
router.post('/products/updateCategory', productController.updateCategory.bind(productController));
router.post('/products/deleteCategory', productController.deleteCategory.bind(productController));
router.post('/products/getCategories', productController.getCategories.bind(productController));

router.post('/products/createBrand', productController.createBrand.bind(productController));
router.post('/products/updateBrand', productController.updateBrand.bind(productController));
router.post('/products/deleteBrand', productController.deleteBrand.bind(productController));
router.post('/products/getBrands', productController.getBrands.bind(productController));
router.post('/products/getUOM', productController.getUOM.bind(productController));
router.post('/products/getProducts', productController.getProducts.bind(productController));
router.post(
  '/products/getProductDetails',
  productController.getProductDetails.bind(productController)
);
router.post('/products/getProductMedia', productController.getProductMedia.bind(productController));
router.post(
  '/products/getProductAttributes',
  productController.getProductAttributes.bind(productController)
);
router.post(
  '/products/uploadMedia',
  upload.single('media'),
  productController.uploadMedia.bind(productController)
);
router.post('/products/deleteMedia', productController.deleteMedia.bind(productController));
router.post('/products/createProduct', productController.createProduct.bind(productController));
router.post('/products/updateProduct', productController.updateProduct.bind(productController));
router.post('/products/deleteProduct', productController.deleteProduct.bind(productController));

export default router;
