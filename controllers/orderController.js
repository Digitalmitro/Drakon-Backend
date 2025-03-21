const Order = require("../models/Order");
const Cart = require("../models/Cart");

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const { userId, paymentMethod, shippingAddress } = req.body;
    const cart = await Cart.findOne({ userId });

    if (!cart || cart.products.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const newOrder = new Order({
      userId,
      products: cart.products,
      subtotal: cart.subtotal,
      shippingCost: cart.shippingCost,
      discount: cart.discount,
      totalAmount: cart.totalAmount,
      paymentMethod,
      shippingAddress,
    });

    await newOrder.save();
    await Cart.findOneAndDelete({ userId });

    res.status(201).json({ message: "Order placed successfully", order: newOrder });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Get User Orders
exports.getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId }).populate("products.productId", "title price image");
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Get Single Order
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate("products.productId", "title price image");
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Update Order Status (Admin Only)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderId, orderStatus } = req.body;
    const order = await Order.findByIdAndUpdate(orderId, { orderStatus }, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};
