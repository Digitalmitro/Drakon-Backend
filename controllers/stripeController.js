const stripe = require("../config/stripeConfig");

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
            success_url: "https://h4snptx0-5173.inc1.devtunnels.ms/cart?success=true",
            cancel_url: "https://h4snptx0-5173.inc1.devtunnels.ms/cart?canceled=true",
          });
      
          res.json({ sessionId: session.id });
        } catch (error) {
          res.status(500).json({ error: error.message });
        }    
};
