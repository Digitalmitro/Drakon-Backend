// controllers/orderController.js
const mongoose    = require("mongoose");
const Order       = require("../models/Order");
const Cart        = require("../models/Cart");
const auth        = require("basic-auth");                 // for Custom Store endpoints :contentReference[oaicite:7]{index=7}
const { create }  = require("xmlbuilder2");                // for building export XML
const parser      = require("fast-xml-parser");            // for parsing ShipNotice XML
const axios       = require("axios");

const SHIP_API_URL    = "https://ssapi.shipstation.com/v2/";
const SHIP_API_KEY    = process.env.SHIPSTATION_API_KEY;
const SHIP_API_SECRET = process.env.SHIPSTATION_API_SECRET;
const SS_USER         = process.env.SS_USER;               // for GET/POST auth
const SS_PASS         = process.env.SS_PASS;

// —————————————— Helper: Basic Auth Middleware ——————————————
function requireBasicAuth(req, res) {
  const creds = auth(req);
  if (!creds || creds.name !== SS_USER || creds.pass !== SS_PASS) {
    res.set("WWW-Authenticate", 'Basic realm="ShipStation"');
    res.status(401).send("Access denied");
    return false;
  }
  return true;
}

// — Create Order (unchanged, but now populates billTo & shipTo) ——
exports.createOrder = async (req, res) => {
  try {
    const userId         = req.rootUser._id;
    const { paymentMethod, shippingAddress, billingAddress, paymentStatus } = req.body;
    const cart           = await Cart.findOne({ userId });
    if (!cart || cart.products.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    // Generate orderNumber from new ObjectId
    const orderNumber = new mongoose.Types.ObjectId().toString();

    const newOrder = new Order({
      orderNumber,
      orderDate:    new Date(),
      userId,
      customerCode: req.rootUser.email,
      billTo:       billingAddress || shippingAddress,
      shipTo:       shippingAddress,
      items:        cart.products.map(p => ({
                      sku:       p.productId.toString(),
                      name:      p.productTitle,
                      quantity:  p.quantity,
                      unitPrice: p.price,
                      options:   p.options || {},
                      location:  p.location || ""
                    })),
      subtotal:     cart.subtotal,
      shippingAmount: cart.shippingCost,
      discount:       cart.discount,
      orderTotal:     cart.totalAmount,
      currencyCode:   "USD",
      paymentMethod,
      paymentStatus,
      orderStatus:    "Processing"
    });

    await newOrder.save();
    await Cart.deleteOne({ userId });
    res.status(201).json({ message: "Order placed", order: newOrder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// — Push Order to ShipStation via API V2 ——
exports.createShippingOrder = async (req, res) => {
  try {
    const { orderNumber, orderDate, orderStatus, customerCode, billTo, shipTo, items } = req.body;
    const orderData = {
      orderNumber, orderDate, orderStatus, customerCode,
      billTo, shipTo, items,
      carrierCode:  "stamps_com",
      serviceCode:  "usps_priority",
      packageCode:  "package",
      confirmation: "delivery",
      weight:       { value: 2, units: "pounds" },
      dimensions:   { length: 10, width: 5, height: 5, units: "inches" }
    };
    const response = await axios.post(
      `${SHIP_API_URL}orders/createorder`,
      orderData,
      {
        auth: {
          username: SHIP_API_KEY,
          password: SHIP_API_SECRET
        },
        headers: { "Content-Type": "application/json" }
      }
    );
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error("ShipStation API Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Failed to create ShipStation order" });
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

exports.exportOrders = async (req, res) => {
  if (!requireBasicAuth(req, res)) return;
  if (req.query.action !== "export")
    return res.status(400).send("Invalid action");

  const { start_date, end_date, page = 1 } = req.query;
  const start = new Date(start_date);
  const end   = new Date(end_date);
  const limit = 20;
  const skip  = (page - 1) * limit;

  const [ total, orders ] = await Promise.all([
    Order.countDocuments({ orderDate: { $gte: start, $lte: end } }),
    Order.find({ orderDate: { $gte: start, $lte: end } }).skip(skip).limit(limit)
  ]);
  const totalPages = Math.ceil(total / limit);

  const root = create({ version:"1.0", encoding:"utf-8" })
    .ele("Orders", { pages: totalPages });

  orders.forEach(o => {
    const od = root.ele("Order");
    od.ele("OrderID").dat(o._id.toString());
    od.ele("OrderNumber").dat(o.orderNumber);
    od.ele("OrderDate").txt(o.orderDate.toLocaleString("en-US",{hour12:false}));
    od.ele("LastModified").txt(o.lastModified.toLocaleString("en-US",{hour12:false}));
    od.ele("OrderStatus").dat(o.orderStatus);
    od.ele("ShippingMethod").dat(o.shippingMethod || "");
    od.ele("PaymentMethod").dat(o.paymentMethod);
    od.ele("CurrencyCode").txt(o.currencyCode);
    od.ele("OrderTotal").txt(o.orderTotal.toFixed(2));
    od.ele("TaxAmount").txt(o.taxAmount.toFixed(2));
    od.ele("ShippingAmount").txt(o.shippingAmount.toFixed(2));
    if (o.customerNotes) od.ele("CustomerNotes").dat(o.customerNotes);
    if (o.internalNotes) od.ele("InternalNotes").dat(o.internalNotes);
    od.ele("Gift").txt(o.gift.toString());
    if (o.giftMessage) od.ele("GiftMessage").dat(o.giftMessage);

    const cust = od.ele("Customer");
    cust.ele("CustomerCode").dat(o.customerCode || "");
    const bill = cust.ele("BillTo");
    Object.entries(o.billTo.toObject()).forEach(([k,v]) => bill.ele(k).dat(v || ""));
    const ship = cust.ele("ShipTo");
    Object.entries(o.shipTo.toObject()).forEach(([k,v]) => ship.ele(k).dat(v || ""));

    const items = od.ele("Items");
    o.items.forEach(i => {
      const it = items.ele("Item");
      it.ele("SKU").dat(i.sku);
      it.ele("Name").dat(i.name);
      it.ele("Quantity").txt(i.quantity);
      it.ele("UnitPrice").txt(i.unitPrice.toFixed(2));
      if (i.options?.size) {
        const opts = it.ele("Options");
        for (let [key,val] of i.options) {
          opts.ele(key).dat(val);
        }
      }
      if (i.location) it.ele("Location").dat(i.location);
    });
  });

  res.header("Content-Type","application/xml");
  res.send(root.end({ prettyPrint: true }));
};

// ————————— Custom Store: Ship Notice POST —————————
exports.shipNotify = async (req, res) => {
  if (!requireBasicAuth(req, res)) return;
  if (req.query.action !== "shipnotify")
    return res.status(400).send("Invalid action");

  const xml = req.body;
  const json = parser.parse(xml, { ignoreAttributes:false, cdataPropName:"dat" });
  const sn   = json.ShipNotice;
  await Order.findOneAndUpdate(
    { orderNumber: sn.OrderNumber },
    {
      orderStatus:   "Shipped",
      lastModified:  new Date(sn.ShipDate),
      shippingMethod:`${sn.Carrier}-${sn.Service}`,
      trackingNumber: sn.TrackingNumber
    }
  );
  res.sendStatus(200);
};

