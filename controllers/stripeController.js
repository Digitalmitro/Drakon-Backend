const stripe = require("../config/stripeConfig");
const Order = require("../models/Order");

function toStringOrEmpty(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function buildStripeMetadata({ orderId, orderNumber }) {
  const metadata = {};
  const resolvedOrderId = toStringOrEmpty(orderId).trim();
  const resolvedOrderNumber = toStringOrEmpty(orderNumber).trim();

  if (resolvedOrderId) metadata.orderId = resolvedOrderId;
  if (resolvedOrderNumber) metadata.orderNumber = resolvedOrderNumber;

  return metadata;
}

async function markOrderPaid({ orderId, orderNumber }) {
  const resolvedOrderId = toStringOrEmpty(orderId).trim();
  const resolvedOrderNumber = toStringOrEmpty(orderNumber).trim();

  if (!resolvedOrderId && !resolvedOrderNumber) return null;

  const query = resolvedOrderId ? { _id: resolvedOrderId } : { orderNumber: resolvedOrderNumber };
  return Order.findOneAndUpdate(
    query,
    { paymentStatus: "Paid", lastModified: new Date() },
    { new: true }
  );
}

function getOrderRefsFromSession(session) {
  const sessionMetadata = session?.metadata || {};
  const paymentIntentMetadata = session?.payment_intent?.metadata || {};

  return {
    orderId:
      sessionMetadata.orderId ||
      paymentIntentMetadata.orderId ||
      "",
    orderNumber:
      sessionMetadata.orderNumber ||
      paymentIntentMetadata.orderNumber ||
      "",
  };
}

function getOrderRefsFromPaymentIntent(paymentIntent) {
  const metadata = paymentIntent?.metadata || {};
  return {
    orderId: metadata.orderId || "",
    orderNumber: metadata.orderNumber || "",
  };
}

exports.createPaymentIntent = async (req, res) => {

  try {
    const { amount, orderId, orderNumber, success_url, cancel_url } = req.body; // Amount in cents
    const metadata = buildStripeMetadata({ orderId, orderNumber });

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
      metadata,
      payment_intent_data: {
        metadata,
      },
      client_reference_id: metadata.orderNumber || metadata.orderId || undefined,
      success_url: success_url || `${process.env.ORIGIN_URL}/checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${process.env.ORIGIN_URL}/cart?canceled=true`,
    });

    res.json({ sessionId: session.id, sessionUrl: session.url, metadata });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.sucessfullPayment = async (req, res) => {
  const { sessionId, orderId, orderNumber } = req.body;
  if (!sessionId)
    return res.status(401).json({ message: "Unauthorized" });

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    if (session.payment_status !== "paid") {
      // Early return so we don't fall through to the success response
      return res
        .status(400)
        .json({ message: "Order Not saved! Payment not completed." });
    }

    const metadataRefs = getOrderRefsFromSession(session);
    const resolvedOrderId = orderId || metadataRefs.orderId;
    const resolvedOrderNumber = orderNumber || metadataRefs.orderNumber;

    const updatedOrder = await markOrderPaid({
      orderId: resolvedOrderId,
      orderNumber: resolvedOrderNumber,
    });

    if ((resolvedOrderId || resolvedOrderNumber) && !updatedOrder) {
      return res.status(404).json({ message: "Order not found for payment update." });
    }

    // Only runs if payment_status === "paid"
    return res.status(200).json({
      message: "Payment successful",
      payment_status: session.payment_status,
      orderUpdated: Boolean(updatedOrder),
      orderId: updatedOrder?._id,
      orderNumber: updatedOrder?.orderNumber,
      metadata: {
        orderId: resolvedOrderId || null,
        orderNumber: resolvedOrderNumber || null,
      },
    });
  } catch (err) {
    console.error("Error confirming order:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

exports.webhook = async (req, res) => {
  try {
    const event = req.body;

    if (!event || !event.type) {
      return res.status(400).json({ message: "Invalid Stripe event payload" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data?.object;
      if (session?.payment_status === "paid") {
        const refs = getOrderRefsFromSession(session);
        await markOrderPaid(refs);
      }
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data?.object;
      const refs = getOrderRefsFromPaymentIntent(paymentIntent);
      await markOrderPaid(refs);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return res.status(500).json({ message: "Webhook processing failed" });
  }
};