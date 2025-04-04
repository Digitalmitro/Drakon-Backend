const Order = require("../models/Order");
const Cart = require("../models/Cart");

const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_URL = "https://ssapi.shipstation.com/v2/";

// Create Order
exports.createOrder = async (req, res) => {
  try {
    const userId  = req.rootUser._id;
    const { paymentMethod, shippingAddress, paymentStatus } = req.body;
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
      paymentStatus
    });

    await newOrder.save();
    await Cart.findOneAndDelete({ userId });

    res.status(201).json({ message: "Order placed successfully", order: newOrder });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Server error" });
  }
};

exports.createShippingOrder = async (req,res) =>{
  cosole.log("call this function")
  try {
    const { orderNumber, orderDate, orderStatus, customerEmail, billTo, shipTo, items } = req.body;

    const orderData = {
      orderNumber,
      orderDate,
      orderStatus,
      customerEmail,
      billTo,
      shipTo,
      items,
      carrierCode: "stamps_com", // Change based on your carrier
      serviceCode: "usps_priority", // Adjust based on shipping type
      packageCode: "package", // Modify as needed
      confirmation: "delivery",
      weight: { value: 2, units: "pounds" },
      dimensions: { length: 10, width: 5, height: 5, units: "inches" },
    };

   
    const response = await axios.post(`${SHIPSTATION_API_URL}/orders/createorder`, orderData, {
      headers: {
        "api-key": `${SHIPSTATION_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    res.json({ success: true, message: "Order created successfully in ShipStation", data: response.data });
  } catch (error) {
    console.error("ShipStation API Error:", error.response ? error.response.data : error.message);
    res.status(500).json({ success: false, message: "Failed to create order in ShipStation" });
  }
}

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

exports.getOrder = async (req, res) => {
    try {
    
      const order = await Order.find().populate("products.productId", "title price image");
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

