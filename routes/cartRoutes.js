const express = require("express");
const router = express.Router();
const cartController = require("../controllers/cartController");
const userAuth = require("../middlewares/userAuth")
router.post("/add", cartController.addToCart);
router.get("/cart", userAuth, cartController.getCart);
router.put("/cart/update",userAuth, cartController.updateCart);
router.delete("/cart/remove",userAuth, cartController.removeFromCart);
router.delete("/cart/clear",userAuth, cartController.clearCart);

module.exports = router;
