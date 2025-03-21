const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const userAuth = require("../middlewares/userAuth");

router.post("/order/create",userAuth, orderController.createOrder);
router.get("/user/:userId", orderController.getUserOrders);
router.get("/:orderId", orderController.getOrderById);
router.put("/update", orderController.updateOrderStatus);
router.get("/order/allorder", orderController.getOrder)

module.exports = router;
