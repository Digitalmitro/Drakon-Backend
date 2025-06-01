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
    // 1) Determine if there’s an authenticated user
    const userIdFromToken = req.rootUser?._id || null;
    let cartItems, subtotal, shippingCost, discount, totalAmount;

    if (userIdFromToken) {
      // ── Authenticated user: look up their Cart in the DB ──
      const cart = await Cart.findOne({ userId: userIdFromToken });
      if (!cart || !cart.products || cart.products.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }
      cartItems    = cart.products;
      subtotal     = cart.subtotal;
      shippingCost = cart.shippingCost;
      discount     = cart.discount;
      totalAmount  = cart.totalAmount;
    } else {
      // ── Guest checkout: expect cart data in the request body ──
      const bodyCart = req.body.cartData;
      if (!Array.isArray(bodyCart) || bodyCart.length === 0) {
        return res.status(400).json({ message: "Cart is empty (guest)" });
      }
      cartItems    = bodyCart;
      subtotal     = req.body.subtotal;
      shippingCost = req.body.shippingCost;
      discount     = req.body.discount;
      totalAmount  = req.body.totalAmount;

      // Validate that all those numbers exist
      if (
        typeof subtotal !== "number" ||
        typeof shippingCost !== "number" ||
        typeof discount !== "number" ||
        typeof totalAmount !== "number"
      ) {
        return res
          .status(400)
          .json({ message: "Missing subtotal/shippingCost/discount/totalAmount for guest" });
      }
    }

    // 2) Extract the rest of the body fields
    const {
      paymentMethod,
      paymentStatus = "Pending",
      shippingAddress,
      billingAddress,
      customerCode   = ""
    } = req.body;

    if (!paymentMethod || !shippingAddress) {
      return res.status(400).json({ message: "Missing required payment or address fields" });
    }

    // 3) Generate a new unique orderNumber
    const orderNumber = new mongoose.Types.ObjectId().toString();

    // 4) Build the “items” array in the shape our Order schema wants
    //    (same for both user‐cart and guest‐cart)
    const itemsForOrder = cartItems.map((p) => ({
      sku:       p.productId.toString(),
      name:      p.productTitle,
      quantity:  p.quantity,
      unitPrice: p.price,
      options:   p.options || {},
      location:  p.location || ""
    }));

    // 5) Construct the new Order document
    const newOrder = new Order({
      orderNumber,
      orderDate:      new Date(),
      userId:         userIdFromToken,           // will be null if guest
      customerCode,                             // allow email or empty string
      billTo:         billingAddress || shippingAddress,
      shipTo:         shippingAddress,
      items:          itemsForOrder,
      subtotal,
      shippingAmount: shippingCost,
      discount,
      orderTotal:     totalAmount,
      currencyCode:   "USD",
      paymentMethod,
      paymentStatus,
      orderStatus:    "Processing"
    });

    // 6) Save the Order, and if it was a logged‐in user, delete their Cart
    await newOrder.save();
    if (userIdFromToken) {
      await Cart.deleteOne({ userId: userIdFromToken });
    }

    return res.status(201).json({ message: "Order placed", order: newOrder });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
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
  // 1) Basic authentication
  if (!requireBasicAuth(req, res)) return;

  // 2) Validate action=export
  if (req.query.action !== "export") {
    return res.status(400).send("Invalid action");
  }

  // 3) Parse start/end dates from query
  const { start_date, end_date, page = 1 } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).send("Missing start_date or end_date");
  }
  const start = new Date(start_date);
  const end   = new Date(end_date);
  const limit = 20;
  const skip  = (page - 1) * limit;

  // 4) Query the Order collection
  const [ total, orders ] = await Promise.all([
    Order.countDocuments({ orderDate: { $gte: start, $lte: end } }),
    Order.find({ orderDate: { $gte: start, $lte: end } })
         .skip(skip)
         .limit(limit)
  ]);
  const totalPages = Math.ceil(total / limit);

  // 5) Build XML using xmlbuilder2
  const root = create({ version: "1.0", encoding: "utf-8" })
    .ele("Orders", { pages: totalPages });

  orders.forEach((o) => {
    const od = root.ele("Order");

    // Order identifiers & dates (ISO-8601)
    od.ele("OrderID").txt(o._id.toString());
    od.ele("OrderNumber").txt(o.orderNumber || "");
    od.ele("OrderDate").txt(o.orderDate.toISOString());
    const lastMod = o.lastModified
      ? o.lastModified.toISOString()
      : o.orderDate.toISOString();
    od.ele("LastModified").txt(lastMod);

    // Map your internal status to a ShipStation‐valid status
    let ssStatus = (o.orderStatus || "").toLowerCase();
    switch (ssStatus) {
      case "processing":
        ssStatus = "awaiting_shipment";
        break;
      // add more mappings if needed
    }
    od.ele("OrderStatus").txt(ssStatus);

    od.ele("ShippingMethod").txt(o.shippingMethod || "");
    od.ele("PaymentMethod").txt(o.paymentMethod || "");
    od.ele("CurrencyCode").txt(o.currencyCode || "USD");

    od.ele("OrderTotal").txt((o.orderTotal || 0).toFixed(2));
    od.ele("TaxAmount").txt((o.taxAmount || 0).toFixed(2));
    od.ele("ShippingAmount").txt((o.shippingAmount || 0).toFixed(2));
    od.ele("Gift").txt(o.gift ? "true" : "false");
    od.ele("CustomerNotes").txt(o.customerNotes || "");
    od.ele("InternalNotes").txt(o.internalNotes || "");
    od.ele("GiftMessage").txt(o.giftMessage || "");

    // Customer & addresses
    const cust = od.ele("Customer");
    cust.ele("CustomerCode").txt(o.customerCode || "");

    // BillTo (capitalized tags exactly)
    const bill = cust.ele("BillTo");
    bill.ele("FullName").txt(o.billTo.fullName || "");
    bill.ele("Company").txt(o.billTo.company || "");
    bill.ele("Phone").txt(o.billTo.phone || "");
    bill.ele("Email").txt(o.billTo.email || "");
    bill.ele("Address1").txt(o.billTo.address1 || "");
    bill.ele("Address2").txt(o.billTo.address2 || "");
    bill.ele("City").txt(o.billTo.city || "");
    bill.ele("State").txt(o.billTo.state || "");
    bill.ele("PostalCode").txt(o.billTo.postalCode || "");
    bill.ele("Country").txt(o.billTo.country || "");

    // ShipTo (capitalized tags exactly)
    const ship = cust.ele("ShipTo");
    ship.ele("FullName").txt(o.shipTo.fullName || "");
    ship.ele("Company").txt(o.shipTo.company || "");
    ship.ele("Phone").txt(o.shipTo.phone || "");
    ship.ele("Email").txt(o.shipTo.email || "");
    ship.ele("Address1").txt(o.shipTo.address1 || "");
    ship.ele("Address2").txt(o.shipTo.address2 || "");
    ship.ele("City").txt(o.shipTo.city || "");
    ship.ele("State").txt(o.shipTo.state || "");
    ship.ele("PostalCode").txt(o.shipTo.postalCode || "");
    ship.ele("Country").txt(o.shipTo.country || "");

    // Items
    const itemsNode = od.ele("Items");
    (o.items || []).forEach((i) => {
      const it = itemsNode.ele("Item");
      it.ele("SKU").txt(i.sku || "");
      it.ele("Name").txt(i.name || "");
      it.ele("Quantity").txt(i.quantity != null ? i.quantity.toString() : "0");
      it.ele("UnitPrice").txt((i.unitPrice || 0).toFixed(2));

      // Build a plain JS object from i.options (Mongoose Map → plain object)
      let plainOpts = {};
      if (i.options && typeof i.options === "object") {
        if (i.options instanceof Map) {
          // Mongoose Map: convert to plain object
          for (const [k, v] of i.options.entries()) {
            plainOpts[k] = v;
          }
        } else {
          // Already a plain object
          plainOpts = i.options;
        }
      }

      // If there are any valid option keys, nest them under <Options>
      const validOptionKeys = Object.keys(plainOpts).filter((optKey) => {
        // Skip any key starting with '$' or containing invalid XML chars
        // XML name must match: ^[A-Za-z_][A-Za-z0-9_.-]*$
        return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(optKey);
      });

      if (validOptionKeys.length > 0) {
        const optsNode = it.ele("Options");
        validOptionKeys.forEach((optKey) => {
          const optVal = plainOpts[optKey];
          // Use .txt() or .dat() to wrap value in CDATA
          optsNode.ele(optKey).txt(optVal != null ? optVal.toString() : "");
        });
      }

      // Location (warehouse, etc.)
      it.ele("Location").txt(i.location || "");
    });
  });

  // 6) Send XML response
  res.header("Content-Type", "application/xml");
  return res.send(root.end({ prettyPrint: true }));
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

