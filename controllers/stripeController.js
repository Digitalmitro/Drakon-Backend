const stripe = require("../config/stripeConfig");
const Order = require("../models/Order");

exports.createPaymentIntent = async (req, res) => {

  try {
    const { amount } = req.body; // Amount in cents

    const session = await stripe.checkout.sessions.create({

      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Total Cart Payment",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.ORIGIN_URL}/checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.ORIGIN_URL}/cart?canceled=true`,
    });

    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sucessfullPayment = async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId)
    return res.status(401).json({ message: "Unauthorized" });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      // Early return so we don't fall through to the success response
      return res
        .status(400)
        .json({ message: "Order Not saved! Payment not completed." });
    }

    // Only runs if payment_status === "paid"
    return res.status(200).json({
      message: "Payment successful",
      payment_status: session.payment_status,
    });
  } catch (err) {
    console.error("Error confirming order:", err);
    return res.status(500).json({ message: "Server error" });
  }
};