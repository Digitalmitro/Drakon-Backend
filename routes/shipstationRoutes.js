const express = require('express');
const router = express.Router();
const shipstationController = require('../controllers/shipstationController');

// GET /shipstation/product/:upc
router.get('/product/:upc', shipstationController.getProductByUPC);

// GET /shipstation/products - return all products with details and UPCs
router.get('/products', shipstationController.getAllProducts);

// POST /shipstation/products/sync-admin - strict sync from admin products only
router.post('/products/sync-admin', shipstationController.syncProductsFromAdmin);

// POST /shipstation/rates
router.post('/rates', shipstationController.getShippingRates);

// GET /api/shipstation/orders - ShipStation Custom Store endpoint
router.get('/orders', shipstationController.getOrdersForShipstation);

// POST /api/shipstation/shipnotify - ShipStation Custom Store ship notice
router.post('/shipnotify', express.text({ type: '*/*' }), shipstationController.shipNotify);

module.exports = router;
