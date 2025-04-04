const express = require("express");
const { createPaymentIntent,sucessfullPayment } = require("../controllers/stripeController");

const router = express.Router();

router.post("/create-payment-intent", createPaymentIntent);
router.post("/confirm",sucessfullPayment)

module.exports = router;
