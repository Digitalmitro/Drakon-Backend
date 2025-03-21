const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.post("/create", orderController.createOrder);
router.get("/user/:userId", orderController.getUserOrders);
router.get("/:orderId", orderController.getOrderById);
router.put("/update", orderController.updateOrderStatus);

module.exports = router;
