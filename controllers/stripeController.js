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
            success_url: "https://drakonui.netlify.app/cart?session_id={CHECKOUT_SESSION_ID}",
            cancel_url: "https://h4snptx0-5173.inc1.devtunnels.ms/cart?canceled=true",
          });
      
          res.json({ sessionId: session.id });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }    
};

exports.sucessfullPayment = async (req,res) =>{
  const { sessionId } = req.body;
  if(!sessionId) return res.status(401).json({message:"unauth"})
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {

      res.status(200).json({ message: "Order Not saved!" });
    }

    return res.status(200).json({ message: "Payment  successful",session:session.payment_status });
  } catch (err) {
    console.error("Error confirming order:", err);
    res.status(500).json({ message: "Server error" });
  }
}
