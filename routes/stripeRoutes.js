const express = require("express");
const { createPaymentIntent, sucessfullPayment, webhook } = require("../controllers/stripeController");

const router = express.Router();

router.post("/create-payment-intent", createPaymentIntent);
router.post("/confirm",sucessfullPayment)
router.post("/webhook", webhook);

module.exports = router;
