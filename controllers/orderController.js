// controllers/orderController.js
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const auth = require("basic-auth");                 // for Custom Store endpoints :contentReference[oaicite:7]{index=7}
const { create } = require("xmlbuilder2");                // for building export XML
const { XMLParser } = require("fast-xml-parser");            // for parsing ShipNotice XML
const axios = require("axios");
const { mapCartItemsToOrderItems, normalizeWeightUnits } = require("../utils/orderItemMapper");

const SHIPSTATION_V1_API_URL = "https://ssapi.shipstation.com";

function normalizeShippingMethodValue(method) {
  if (!method) return "";

  if (typeof method === "string") {
    return method.trim();
  }

  if (typeof method === "object") {
    if (method.carrierCode || method.serviceCode || method.packageCode || method.confirmation) {
      const carrierCode = String(method.carrierCode || "stamps_com").trim();
      const serviceCode = String(method.serviceCode || "").trim();
      const packageCode = String(method.packageCode || "package").trim();
      const confirmation = String(method.confirmation || "none").trim();
      return [carrierCode, serviceCode, packageCode, confirmation].join("|");
    }

    if (method.serviceName) return String(method.serviceName).trim();
  }

  return "";
}

function resolveOrderShippingMethod(payloadShippingMethod, cartItems) {
  const explicit = normalizeShippingMethodValue(payloadShippingMethod);
  if (explicit) return explicit;

  if (!Array.isArray(cartItems)) return "";

  for (const item of cartItems) {
    const normalized = normalizeShippingMethodValue(item?.shippingMethod);
    if (normalized) return normalized;
  }

  return "";
}

function normalizeShipstationConfig(config = {}) {
  if (!config || typeof config !== "object") {
    return {
      carrierCode: "",
      serviceCode: "",
      packageCode: "",
      confirmation: "",
    };
  }

  return {
    carrierCode: config.carrierCode ? String(config.carrierCode).trim() : "",
    serviceCode: config.serviceCode ? String(config.serviceCode).trim() : "",
    packageCode: config.packageCode ? String(config.packageCode).trim() : "",
    confirmation: config.confirmation ? String(config.confirmation).trim() : "",
  };
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function convertWeightToPounds(value, units) {
  const weight = toNumber(value, 0);
  if (weight <= 0) return 0;

  const normalized = normalizeWeightUnits(units);
  if (normalized === "Pounds") return weight;
  if (normalized === "Ounces") return weight / 16;
  if (normalized === "Grams") return weight / 453.592;
  if (normalized === "Kilograms") return weight * 2.20462;

  return weight;
}

function getOrderWeightInPounds(order = {}) {
  const total = (Array.isArray(order.items) ? order.items : []).reduce((sum, item) => {
    const qty = Math.max(1, toNumber(item?.quantity, 1));
    return sum + convertWeightToPounds(item?.weight, item?.weightUnits) * qty;
  }, 0);

  if (total > 0) return total;
  return toNumber(process.env.SHIPSTATION_DEFAULT_WEIGHT_POUNDS, 1);
}

function mapAddressForShipstation(address = {}) {
  return {
    name: address.fullName || "",
    company: address.company || "",
    street1: address.address1 || "",
    street2: address.address2 || "",
    city: address.city || "",
    state: address.state || "",
    postalCode: address.postalCode || address.zip || "",
    country: address.country || "US",
    phone: address.phone || "",
  };
}

function parseShipstationConfigFromOrder(order = {}) {
  const defaultCarrierCode = String(process.env.SHIPSTATION_DEFAULT_CARRIER_CODE || "stamps_com").trim();
  const defaultPackageCode = String(process.env.SHIPSTATION_DEFAULT_PACKAGE_CODE || "package").trim();
  const defaultConfirmation = String(process.env.SHIPSTATION_DEFAULT_CONFIRMATION || "none").trim();

  let carrierCode = defaultCarrierCode;
  let serviceCode = order.customField1 ? String(order.customField1).trim() : "";
  let packageCode = order.customField2 ? String(order.customField2).trim() : defaultPackageCode;
  let confirmation = order.customField3 ? String(order.customField3).trim() : defaultConfirmation;

  const rawShippingMethod = order.shippingMethod ? String(order.shippingMethod).trim() : "";
  if (rawShippingMethod.includes("|")) {
    const [carrierRaw, serviceRaw, packageRaw, confirmationRaw] = rawShippingMethod.split("|").map((part) => String(part || "").trim());
    carrierCode = carrierRaw || carrierCode;
    serviceCode = serviceRaw || serviceCode;
    packageCode = packageRaw || packageCode;
    confirmation = confirmationRaw || confirmation;
  }

  return {
    carrierCode,
    serviceCode,
    packageCode,
    confirmation,
  };
}

function buildShipstationOrderPayload(order = {}) {
  const cfg = parseShipstationConfigFromOrder(order);
  const useDirectServiceCodes = String(process.env.SHIPSTATION_USE_DIRECT_SERVICE_CODES || "true").toLowerCase() !== "false";
  const rawShippingMethod = order.shippingMethod ? String(order.shippingMethod).trim() : "";
  const requestedShippingService = rawShippingMethod && !rawShippingMethod.includes("|")
    ? rawShippingMethod
    : (cfg.serviceCode || "");
  const dimensions = {
    units: "inches",
    length: toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_LENGTH, 10),
    width: toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_WIDTH, 8),
    height: toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_HEIGHT, 4),
  };

  const items = (Array.isArray(order.items) ? order.items : []).map((item, index) => ({
    lineItemKey: `${order.orderNumber || order._id}-${index + 1}`,
    sku: item.sku || item.upc || `item-${index + 1}`,
    name: item.name || `Item ${index + 1}`,
    imageUrl: "",
    weight: {
      value: Math.max(0, convertWeightToPounds(item.weight, item.weightUnits)),
      units: "pounds",
    },
    quantity: Math.max(1, toNumber(item.quantity, 1)),
    unitPrice: toNumber(item.unitPrice, 0),
    taxAmount: 0,
    shippingAmount: 0,
    warehouseLocation: item.location || "",
    options: [],
    fulfillmentSku: item.sku || item.upc || "",
    adjustment: false,
    upc: item.upc || "",
    createDate: new Date(order.orderDate || Date.now()).toISOString(),
    modifyDate: new Date(order.lastModified || order.orderDate || Date.now()).toISOString(),
  }));

  const payload = {
    orderNumber: order.orderNumber,
    orderKey: String(order._id || order.orderNumber || ""),
    orderDate: new Date(order.orderDate || Date.now()).toISOString(),
    orderStatus: "awaiting_shipment",
    customerUsername: order.customerCode || order.billTo?.email || order.shipTo?.email || order.orderNumber,
    customerEmail: order.billTo?.email || order.shipTo?.email || "",
    billTo: mapAddressForShipstation(order.billTo),
    shipTo: mapAddressForShipstation(order.shipTo),
    items,
    amountPaid: toNumber(order.orderTotal, 0),
    taxAmount: toNumber(order.taxAmount, 0),
    shippingAmount: toNumber(order.shippingAmount, 0),
    customerNotes: order.customerNotes || "",
    internalNotes: order.internalNotes || "",
    gift: !!order.gift,
    giftMessage: order.giftMessage || "",
    paymentMethod: order.paymentMethod || "",
    requestedShippingService,
    confirmation: cfg.confirmation,
    shipDate: new Date().toISOString(),
    weight: {
      value: getOrderWeightInPounds(order),
      units: "pounds",
    },
    dimensions,
    customField1: order.customField1 || cfg.serviceCode || "",
    customField2: order.customField2 || cfg.packageCode || "",
    customField3: order.customField3 || cfg.confirmation || "",
    advancedOptions: {
      customField1: order.customField1 || cfg.serviceCode || "",
      customField2: order.customField2 || cfg.packageCode || "",
      customField3: order.customField3 || cfg.confirmation || "",
    },
  };

  if (useDirectServiceCodes) {
    payload.carrierCode = cfg.carrierCode;
    payload.serviceCode = cfg.serviceCode;
    payload.packageCode = cfg.packageCode;
  }

  return payload;
}

async function pushOrderToShipstation(order) {
  const shouldPush = String(process.env.SHIPSTATION_PUSH_ORDER_ON_CREATE || "true").toLowerCase() !== "false";
  if (!shouldPush) {
    return { enabled: false, success: false, reason: "SHIPSTATION_PUSH_ORDER_ON_CREATE disabled" };
  }

  if (!SHIP_API_KEY || !SHIP_API_SECRET) {
    return { enabled: true, success: false, reason: "Missing SHIPSTATION_API_KEY/SHIPSTATION_API_SECRET" };
  }

  try {
    const payload = buildShipstationOrderPayload(order);
    const response = await axios.post(
      `${SHIPSTATION_V1_API_URL}/orders/createorder`,
      payload,
      {
        auth: {
          username: SHIP_API_KEY,
          password: SHIP_API_SECRET,
        },
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    return {
      enabled: true,
      success: true,
      orderId: response.data?.orderId || null,
      orderKey: response.data?.orderKey || null,
    };
  } catch (error) {
    const payload = buildShipstationOrderPayload(order);
    const responseBody = error.response?.data;
    const responseBodyText = typeof responseBody === "string"
      ? responseBody
      : (responseBody ? JSON.stringify(responseBody) : "");

    console.error("ShipStation createorder failed", {
      orderNumber: order?.orderNumber,
      status: error.response?.status || null,
      statusText: error.response?.statusText || null,
      responseBody: responseBody || null,
      payloadSummary: {
        orderNumber: payload?.orderNumber,
        orderStatus: payload?.orderStatus,
        carrierCode: payload?.carrierCode,
        serviceCode: payload?.serviceCode,
        packageCode: payload?.packageCode,
        confirmation: payload?.confirmation,
        weight: payload?.weight,
        dimensions: payload?.dimensions,
        itemCount: Array.isArray(payload?.items) ? payload.items.length : 0,
      },
    });

    return {
      enabled: true,
      success: false,
      reason:
        error.response?.data?.ExceptionMessage ||
        error.response?.data?.message ||
        responseBodyText ||
        error.message,
    };
  }
}

const SHIP_API_URL = "https://ssapi.shipstation.com/v2/";
const SHIP_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIP_API_SECRET = process.env.SHIPSTATION_API_SECRET;
const SS_USER = process.env.SS_USER;               // for GET/POST auth
const SS_PASS = process.env.SS_PASS;

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


  console.log("Creating order with body:", req.body);

  try {
    // 1) Determine if there’s an authenticated user
    const userIdFromToken = req.rootUser?._id || null;
    let cartItems, subtotal, shippingCost, discount, totalAmount;
    // console.log(userIdFromToken);
    if (userIdFromToken) {
      // ── Authenticated user: look up their Cart in the DB ──
      const cart = await Cart.findOne({ userId: userIdFromToken }).populate({
        path: "products.productId",
        select: "title sku weight weightUnits upc size",
      });
      if (!cart || !cart.products || cart.products.length === 0) {
        return res.status(400).json({ message: "Cart is empty" });
      }
      cartItems = cart.products;
      subtotal = cart.subtotal;
      shippingCost = cart.shippingCost;
      discount = cart.discount;
      totalAmount = cart.totalAmount;
    } else {
      // ── Guest checkout: expect cart data in the request body ──
      const bodyCart = req.body.cartData;
      if (!Array.isArray(bodyCart) || bodyCart.length === 0) {
        return res.status(400).json({ message: "Cart is empty (guest)" });
      }
      cartItems = bodyCart;
      subtotal = req.body.subtotal;
      shippingCost = req.body.shippingCost;
      discount = req.body.discount;
      totalAmount = req.body.totalAmount;

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
      customerCode = "",
      shippingMethod,
      shipstationConfig,
    } = req.body;

    if (!paymentMethod || !shippingAddress) {
      return res.status(400).json({ message: "Missing required payment or address fields" });
    }

    // 3) Generate a new unique orderNumber
    const orderNumber = new mongoose.Types.ObjectId().toString();

    // 4) Build the “items” array in the shape our Order schema wants
    //    (same for both user‐cart and guest‐cart)


    const itemsForOrder = mapCartItemsToOrderItems(cartItems);

    // 5) Construct the new Order document
    const resolvedShippingMethod = resolveOrderShippingMethod(shippingMethod, cartItems);
    const normalizedShipstationConfig = normalizeShipstationConfig(shipstationConfig);

    const newOrder = new Order({
      orderNumber,
      orderDate: new Date(),
      userId: userIdFromToken,           // will be null if guest
      customerCode,                             // allow email or empty string
      billTo: billingAddress || shippingAddress,
      shipTo: shippingAddress,
      items: itemsForOrder,
      subtotal,
      shippingAmount: shippingCost,
      discount,
      orderTotal: totalAmount,
      currencyCode: "USD",
      shippingMethod: resolvedShippingMethod || undefined,
      customField1: normalizedShipstationConfig.serviceCode || undefined,
      customField2: normalizedShipstationConfig.packageCode || undefined,
      customField3: normalizedShipstationConfig.confirmation || undefined,
      paymentMethod,
      paymentStatus,
      orderStatus: "Processing"
    });

    // 6) Save the Order, and if it was a logged‐in user, delete their Cart
    await newOrder.save();
    if (userIdFromToken) {
      await Cart.deleteOne({ userId: userIdFromToken });
    }

    const shipstationSync = await pushOrderToShipstation(newOrder);
    if (!shipstationSync.success) {
      console.error("ShipStation order sync failed:", shipstationSync.reason || "Unknown error");
    }

    return res.status(201).json({ message: "Order placed", order: newOrder, shipstationSync });
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
      carrierCode: "stamps_com",
      serviceCode: "usps_priority",
      packageCode: "package",
      confirmation: "delivery",
      weight: { value: 2, units: "pounds" },
      dimensions: { length: 10, width: 5, height: 5, units: "inches" }
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
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Get Single Order
exports.getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

exports.getOrder = async (req, res) => {
  const userId = req.rootUser?._id;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized: No user found" });
  }

  try {
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }); // Only fetch orders for the logged-in user

    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No orders found for this user" });
    }

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Server error" });
  }
};


exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }); // latest orders first
    if (!orders || orders.length === 0) {
      return res.status(404).json({ message: "No orders found" });
    }
    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
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

// Helper to format JS Date → “MM/DD/YYYY HH:MM:SS”
function toShipStationDate(dt) {
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${mi}:${ss}`;
}

function mapCustomStoreStatus({ paymentStatus, orderStatus, status }) {
  const paidStatus = process.env.SHIPSTATION_CUSTOMSTORE_PAID_STATUS || "paid";
  const unpaidStatus = process.env.SHIPSTATION_CUSTOMSTORE_UNPAID_STATUS || "unpaid";
  const shippedStatus = process.env.SHIPSTATION_CUSTOMSTORE_SHIPPED_STATUS || "shipped";
  const cancelledStatus = process.env.SHIPSTATION_CUSTOMSTORE_CANCELLED_STATUS || "cancelled";
  const onHoldStatus = process.env.SHIPSTATION_CUSTOMSTORE_ON_HOLD_STATUS || "on_hold";

  const payment = paymentStatus ? String(paymentStatus).toLowerCase() : "";
  const order = orderStatus ? String(orderStatus).toLowerCase() : "";
  const legacy = status ? String(status).toLowerCase() : "";

  if (["paid", "completed"].includes(payment)) return paidStatus;
  if (["shipped", "delivered"].includes(order) || ["shipped", "delivered"].includes(legacy)) return shippedStatus;
  if (["cancelled", "canceled"].includes(order) || ["cancelled", "canceled"].includes(legacy)) return cancelledStatus;
  if (["on_hold", "on-hold", "hold"].includes(order) || ["on_hold", "on-hold", "hold"].includes(legacy)) return onHoldStatus;
  return unpaidStatus;
}

exports.exportOrders = async (req, res) => {
  // 1) Enforce Basic Auth
  if (!requireBasicAuth(req, res)) return;

  // 2) Must be ?action=export
  if (req.query.action !== "export") {
    return res.status(400).send("Invalid action");
  }

  // 3) Parse start/end dates
  const { start_date, end_date, page = 1 } = req.query;
  if (!start_date || !end_date) {
    return res.status(400).send("Missing start_date or end_date");
  }
  const start = new Date(start_date);
  const end = new Date(end_date);
  const limit = 20;
  const skip = (page - 1) * limit;

  // 4) Query MongoDB for orders in date range
  const [total, orders] = await Promise.all([
    Order.countDocuments({ orderDate: { $gte: start, $lte: end } }),
    Order.find({ orderDate: { $gte: start, $lte: end } })
      .skip(skip)
      .limit(limit)
  ]);
  const totalPages = Math.ceil(total / limit);

  // 5) Build XML response
  const root = create({ version: "1.0", encoding: "utf-8" })
    .ele("Orders", { pages: totalPages });

  orders.forEach((o) => {
    const od = root.ele("Order");

    // ─── OrderID & OrderNumber ───
    od.ele("OrderID").txt(o._id.toString());
    od.ele("OrderNumber").txt(o.orderNumber || "");

    // ─── OrderDate & LastModified (MM/DD/YYYY HH:MM:SS) ───
    od.ele("OrderDate").txt(toShipStationDate(o.orderDate));
    const lastMod = o.lastModified || o.orderDate;
    od.ele("LastModified").txt(toShipStationDate(lastMod));

    // ─── Map internal status → ShipStation Custom Store status ───
    const ssStatus = mapCustomStoreStatus({
      paymentStatus: o.paymentStatus,
      orderStatus: o.orderStatus,
      status: o.status,
    });
    od.ele("OrderStatus").txt(ssStatus);

    // ─── ShippingMethod, PaymentMethod, CurrencyCode ───
    od.ele("ShippingMethod").txt(o.shippingMethod || "");
    od.ele("PaymentMethod").txt(o.paymentMethod || "");
    od.ele("CurrencyCode").txt(o.currencyCode || "USD");

    // ─── Compute OrderTotal from items + shipping + tax − discount ───
    // Sum up each line: unitPrice × quantity
    const itemsTotal = (o.items || []).reduce((sum, i) => {
      const linePrice = (i.unitPrice || 0) * (i.quantity || 0);
      return sum + linePrice;
    }, 0);

    // If you store shipping and tax separately, include those too:
    const shippingAmt = o.shippingAmount || 0;
    const taxAmt = o.taxAmount || 0;
    const discountAmt = o.discount || 0;   // if you track discounts at the order level

    // Final order total = items + shipping + tax − discount
    const computedTotal = itemsTotal + shippingAmt + taxAmt - discountAmt;

    od.ele("OrderTotal").txt(computedTotal.toFixed(2));
    od.ele("TaxAmount").txt(taxAmt.toFixed(2));
    od.ele("ShippingAmount").txt(shippingAmt.toFixed(2));
    od.ele("Gift").txt(o.gift ? "true" : "false");

    // ─── Optional notes ───
    od.ele("CustomerNotes").txt(o.customerNotes || "");
    od.ele("InternalNotes").txt(o.internalNotes || "");
    od.ele("GiftMessage").txt(o.giftMessage || "");

    // ─── Customer block ───
    const cust = od.ele("Customer");
    cust.ele("CustomerCode").txt(o.customerCode || "");

    // ─── BillTo (capitalized tags, using <Name> instead of <FullName>) ───
    const bill = cust.ele("BillTo");
    bill.ele("Name").txt(o.billTo.fullName || "");
    bill.ele("Company").txt(o.billTo.company || "");
    bill.ele("Phone").txt(o.billTo.phone || "");
    bill.ele("Email").txt(o.billTo.email || "");
    bill.ele("Street1").txt(o.billTo.address1 || "");
    bill.ele("Street2").txt(o.billTo.address2 || "");
    bill.ele("City").txt(o.billTo.city || "");
    bill.ele("State").txt(o.billTo.state || "");
    bill.ele("PostalCode").txt(o.billTo.postalCode || "");
    bill.ele("Country").txt(o.billTo.country || "");

    // ─── ShipTo (capitalized tags, no <Email> or <Phone> in ShipTo) ───
    const ship = cust.ele("ShipTo");
    ship.ele("Name").txt(o.shipTo.fullName || "");
    ship.ele("Company").txt(o.shipTo.company || "");
    ship.ele("Street1").txt(o.shipTo.address1 || "");
    ship.ele("Street2").txt(o.shipTo.address2 || "");
    ship.ele("City").txt(o.shipTo.city || "");
    ship.ele("State").txt(o.shipTo.state || "");
    ship.ele("PostalCode").txt(o.shipTo.postalCode || "");
    ship.ele("Country").txt(o.shipTo.country || "");

    // ─── Items block ───
    const itemsNode = od.ele("Items");
    (o.items || []).forEach((i) => {
      const it = itemsNode.ele("Item");
      const sku = i.sku || i.upc || "";
      const upc = i.upc || "";
      const normalizedWeight = Number.isFinite(Number(i.weight)) ? Number(i.weight) : 0;
      const normalizedWeightUnits = normalizeWeightUnits(i.weightUnits);

      it.ele("SKU").txt(sku);
      it.ele("UPC").txt(upc);
      it.ele("Name").txt(i.name || "");
      it.ele("Quantity").txt(i.quantity != null ? i.quantity.toString() : "0");
      it.ele("UnitPrice").txt((i.unitPrice || 0).toFixed(2));

      // Convert i.options (Mongoose Map or object) → plain JS object
      let plainOpts = {};
      if (i.options && typeof i.options === "object") {
        if (i.options instanceof Map) {
          for (const [k, v] of i.options.entries()) {
            plainOpts[k] = v;
          }
        } else {
          plainOpts = i.options;
        }
      }

      if (i.size) {
        plainOpts.Size = String(i.size);
      }

      // Filter valid XML names and build <Options> if any
      const validOptionKeys = Object.keys(plainOpts).filter((optKey) => {
        return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(optKey);
      });

      if (validOptionKeys.length > 0) {
        const optsNode = it.ele("Options");
        validOptionKeys.forEach((optKey) => {
          const optVal = plainOpts[optKey];
          optsNode.ele(optKey).txt(optVal != null ? optVal.toString() : "");
        });
      }

      it.ele("Weight").txt(normalizedWeight.toFixed(2));
      it.ele("WeightUnits").txt(normalizedWeightUnits);

      // Location (optional)
      it.ele("Location").txt(i.location || "");
    });
  });

  // 6) Send XML with correct Content-Type
  res.header("Content-Type", "application/xml");
  return res.send(root.end({ prettyPrint: true }));
};

// ————————— Custom Store: Ship Notice POST —————————
exports.shipNotify = async (req, res) => {
  if (!requireBasicAuth(req, res)) return;
  if (req.query.action !== "shipnotify")
    return res.status(400).send("Invalid action");

  const xml = req.body;
  const xmlParser = new XMLParser({ ignoreAttributes: false, cdataPropName: "dat" });
  const json = xmlParser.parse(xml);
  const sn = json.ShipNotice;
  await Order.findOneAndUpdate(
    { orderNumber: sn.OrderNumber },
    {
      orderStatus: "Shipped",
      lastModified: new Date(sn.ShipDate),
      shippingMethod: `${sn.Carrier}-${sn.Service}`,
      trackingNumber: sn.TrackingNumber
    }
  );
  res.sendStatus(200);
};



exports.createTestOrder = async (req, res) => {

  try {
    const dummyOrder = new Order({
      orderNumber: "ORD" + Math.floor(Math.random() * 1000000), // Unique-ish
      orderDate: new Date(),

      userId: null, // not setting any user yet
      customerCode: "guest@example.com",

      billTo: {
        fullName: "Dummy Bill",
        phone: "1234567890",
        email: "bill@example.com",
        address1: "123 Fake Street",
        city: "Faketown",
        postalCode: "12345",
        country: "Neverland",
      },
      shipTo: {
        fullName: "Dummy Ship",
        phone: "0987654321",
        email: "ship@example.com",
        address1: "456 Imaginary Road",
        city: "Nowhere City",
        postalCode: "54321",
        country: "Neverland",
      },

      items: [
        {
          sku: "SKU123",
          upc: "012345678905",
          name: "Dummy Product",
          size: "M",
          weight: 1.25,
          weightUnits: "Pounds",
          quantity: 2,
          unitPrice: 19.99,
          location: "Warehouse A",
        },
      ],

      subtotal: 39.98,
      taxAmount: 2.00,
      shippingAmount: 5.00,
      discount: 0,
      orderTotal: 46.98,

      currencyCode: "USD",
      shippingMethod: "USPSPriorityMail",
      paymentMethod: "Credit Card",
      paymentStatus: "Paid",
      orderStatus: "Processing",

      customerNotes: "This is a dummy order",
      gift: false,
    });

    const saved = await dummyOrder.save();
    res.status(201).json({
      message: "Dummy order saved successfully",
      orderId: saved._id,
    });
  } catch (err) {
    console.error("Failed to create dummy order:", err);
    res.status(500).json({ error: "Failed to save dummy order" });
  }

};