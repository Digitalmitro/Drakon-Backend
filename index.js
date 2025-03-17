
//admin ---      process.env.REACT_APP_BACKEND_API
// client ---   import.meta.env.VITE_BACKEND_API
require("dotenv").config();
const express = require("express");
const nodemailer = require("nodemailer");
const twilio = require("twilio");
const bodyParser = require("body-parser");
// const bodyParser = require('body-parser');
//to protect user data//
const {
  RegisteradminModal,
} = require("./models/AdminModel/RegisterAdminModel");
const {
  RegisterclientModal,
} = require("./models/ClientModel/RegisterClientModel");
const { ProductsModal } = require("./models/AdminModel/ProductModel");
const { CouponModel } = require("./models/AdminModel/CouponModel");
const { SubscribedModel } = require("./models/AdminModel/subsrcibedModel");
const IndexCMS = require("./models/CMS/IndexCMS");
const { AllordersModel } = require("./models/AdminModel/AllOrdersModel");
const {
  AccountdetailModel,
} = require("./models/ClientModel/AccountDetailsModel");
const { OrderModal } = require("./models/ClientModel/OrdersModel");

const { MessageModel } = require("./models/ClientModel/MessageModel");
const { WishlistModal } = require("./models/ClientModel/WishlistModel");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { connect } = require("./config/db");
const jwt = require("jsonwebtoken");
const {
  AddressbookBillingModel,
} = require("./models/ClientModel/AddressBookBillingModel");
const {
  AddressBookShippingModel,
} = require("./models/ClientModel/AddressBookShippingModel");
const FooterCMS = require("./models/CMS/FooterCMS");
const LogoCMS = require("./models/CMS/LogoCMS");
const Tax = require("./models/AdminModel/TaxModel");
const GenaralSetting = require("./models/General Setting/GeneralSettingModel");
const {
  FeaturedpoductModal,
} = require("./models/ClientModel/FeaturedProducts");
const {
  InventoryroductModal,
} = require("./models/ClientModel/InventoryProduct");

require("dotenv").config();

const Port = process.env.port;

const server = express();
server.use(express.json());
server.use(cors());
server.use(bodyParser.json());
// require("./config/db");
const connection = require("./config/db");
const adminAuth = require("./models/middlewares/adminAuth");
const userAuth = require("./models/middlewares/userAuth");

connection();

//welcome
server.get("/", (req, res) => {
  res.send("welcome");
});

const port = process.env.port;
const secret_key = process.env.secret_key;

//sent sms - useing twillio
const accountSid = "ACbbdc16ced05d3d2fa4d8a7fe2b014147"; // Your Twilio Account SID
const authToken = "6b8cfb5183fc475f58ecc0e0b895aa2b"; // Your Twilio Auth Token
const twilioPhoneNumber = "+18288275476"; // Your Twilio phone number
const client = twilio(accountSid, authToken);

server.post("/send-sms", (req, res) => {
  const { to, body } = req.body;

  if (!to || !body) {
    return res.status(400).send('Both "to" and "body" are required.');
  }

  client.messages
    .create({
      body,
      from: twilioPhoneNumber,
      to,
    })
    .then(() => {
      res.send("SMS sent successfully!");
    })
    .catch((err) => {
      console.error("Error sending SMS:", err);
      res.status(500).send("Failed to send SMS.");
    });
});

// Gmail sent
server.post("/send-email", async (req, res) => {
  const { to, subject, text } = req.body;

  // Create a nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "tirtho.digitalmitro@gmail.com",
      pass: "iyyq whed pthy yuhs",
    },
  });

  // Define email options
  const mailOptions = {
    from: "tirtho.digitalmitro@gmail.com",
    to,
    subject,
    text,
  };

  // Send the email
  try {
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Subscribed" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error sending email" });
  }
});

server.post("/subscribe", async (req, res) => {
  const { email } = req.body;

  try {
    const newPackage = new SubscribedModel({
      email,
    });
    await newPackage.save();
    res.send(" user subscribed");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

server.get("/subscribe", async (req, res) => {
  try {
    const data = await SubscribedModel.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

server.post("/message", async (req, res) => {
  const { name, email, message, date, status, user_id } = req.body;

  try {
    // Create a new instance of investor packageModel
    const newPackage = new MessageModel({
      name,
      email,
      message,
      date,
      status,
      user_id,
    });

    // Save the package to the database
    await newPackage.save();

    // Update the user's packages array
    await RegisterclientModal.findByIdAndUpdate(
      user_id,
      { $push: { message: newPackage._id } },
      { new: true }
    );

    // Send a success response
    res.send(" message Created ");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

// All message
server.get("/message", async (req, res) => {
  try {
    const data = await MessageModel.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

// message by ID
server.get("/message/:id", async (req, res) => {
  const ID = req.params.id;
  try {
    const data = await MessageModel.findById(ID);
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

//ADMIN Section
// ADMIN  Register//
server.post("/registeradmin", async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  try {
    // Check if the email already exists in the database
    const existingAdvisor = await RegisteradminModal.findOne({email});

    if (existingAdvisor) {
      // If email already exists, send an error response
      res.status(400).send("Admin already exists");
    } else {
      // Hash the password
      bcrypt.hash(password, 5, async (err, hash) => {
        if (err) {
          console.log(err);
        } else {
          // Create a new instance of RegisteradvisorModal with the hashed password
          const newData = new RegisteradminModal({
            name,
            email,
            phone,
            password: hash,
            role,
          });

          // Save the advisor data to the database
          await newData.save();

          // Send a success response
          res.json({ message: "Registered successfully" });
        }
      });
    }
  } catch (error) {
    // Handle other errors, such as missing details in the request
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

//ADMIN Login
// server.post("/loginadmin", async (req, res) => {
//   const { email, password } = req.body;
//   try {
//     const user = await RegisteradminModal.findOne({ email });
//     if (user) {
//       bcrypt.compare(password, user.password, (err, result) => {
//         if (result) {
//           const token = jwt.sign(
//             {
//               _id: user._id,
//               name: user.name,
//               email: user.email,
//               phone: user.phone,
//               role: user.role,
//             },
//             "Tirtho"
//           );
//           res.json({
//             status: "login successful",
//             token: token,
//             user: {
//               name: user.name,
//               email: user.email,
//               phone: user.phone,
//               role: user.role,
//               _id: user._id,

//               // Add other user details if needed
//             },
//           });
//         } else {
//           res.status(401).json({ status: "wrong entry" });
//         }
//       });
//     } else {
//       res.status(404).json({ status: "user not found" });
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ status: "internal server error" });
//   }
// });

server.post("/loginadmin", async (req, res) => {
  try {
    const logEmail = req.body.email;
    const logPass = req.body.password;

    if (!logEmail || !logPass) {
      return res
        .status(422)
        .json({ message: "Please fill all the fields.", success: false });
    }

    const adminFound = await RegisteradminModal.findOne({ email: logEmail });

    // console.log(adminFound);

    if (adminFound) {
      const passCheck = await bcrypt.compare(logPass, adminFound.password);
      const token = await adminFound.generateAuthToken();

      if (passCheck) {
        res.status(200).json({
          message: "Logged In Successfully!",
          token: token,
          success: true,
          Admin: {
            id: adminFound._id,
            name: adminFound.name,
            email: adminFound.email,
          },
        });
      } else {
        res
          .status(400)
          .json({ message: "Invalid login credentials", success: false });
      }
    } else {
      res.status(422).json({ message: "Admin Not Found !", success: false });
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Invalid login credentials", success: false });
  }
});

// Check Token API
server.get("/check-admin-token", adminAuth, async (req, res) => {
  try {
    // If the middleware passed, the token is valid
    res.status(200).json({ message: "Token is valid" });
  } catch (error) {
    res.status(500).json({ error: "Unable to verify token" });
  }
});

// GET all ADMIN
server.get("/getalladmin", async (req, res) => {
  try {
    const data = await RegisteradminModal.find();
    res.send(data);
  } catch (error) {
    res.status(500).json(error);
  }
});

//PRODUCTS SECTION
server.post("/products", async (req, res) => {
  const { image, title, description, category, price, stock, review } =
    req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new ProductsModal({
      image,
      title,
      description,
      category,
      price,
      stock,
      review,
    });
    // Save the package to the database
    await newPackage.save();
    // Send a success response
    res.send("product created successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

//product-filter query props

server.get("/products-filters", async (req, res) => {
  const { category } = req.query;
  try {
    let products;
    if (category) {
      products = await ProductsModal.find({ category: category });
    } else {
      products = await ProductsModal.find();
    }
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

//INSERT MANY
server.post("/products/batch", async (req, res) => {
  const products = req.body;

  try {
    // Insert multiple products into the database
    await ProductsModal.insertMany(products);

    // Send a success response
    res.send("Products created successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

// GET all products
server.get("/products", async (req, res) => {
  try {
    const products = await ProductsModal.find();
    res.send(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

server.get("/products-by-category/:category", async (req, res) => {
  try {
    const category = req.params.category;
    const products = await ProductsModal.find({ category });
    res.send(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET product by ID
server.get("/products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await ProductsModal.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// DELETE product by ID
server.delete("/products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const deletedProduct = await ProductsModal.findByIdAndDelete(productId);
    if (!deletedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// UPDATE product by ID
server.put("/products/:id", async (req, res) => {
  const productId = req.params.id;
  const updateData = req.body;

  try {
    const updatedProduct = await ProductsModal.findByIdAndUpdate(
      productId,
      updateData,
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: "Product updated successfully", updatedProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET product review by ID
server.get("/product-review/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const products = await ProductsModal.findById(productId);
    if (!products) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ reviews: products.review });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// UPDATE product review by id
server.put("/product-review/:id", async (req, res) => {
  const productId = req.params.id;
  const { review } = req.body;

  try {
    const product = await ProductsModal.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    product.review.push(...review);
    await product.save();
    res.json({ message: "Product updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Coupon Section
// Create Coupon ADMIN populate
server.post("/coupon", async (req, res) => {
  const { couponName, discount, limit, expiryDate, status, user_id } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new CouponModel({
      couponName,
      discount,
      limit,
      expiryDate,
      status,
      user_id,
    });

    // Save the package to the database
    await newPackage.save();

    // Update the user's packages array
    await RegisteradminModal.findByIdAndUpdate(
      user_id,
      { $push: { coupon: newPackage._id } },
      { new: true }
    );

    // Send a success response
    res.send("Coupon Created");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// ADMIN all created Coupon
server.get("/coupon", async (req, res) => {
  try {
    const data = await CouponModel.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

server.get("/coupon/:id", async (req, res) => {
  const couponID = req.params.id;

  try {
    const product = await CouponModel.findById(couponID);
    if (!product) {
      return res.status(404).json({ error: "coupon not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
//UPDATE Current coupon
server.put("/coupon/:id", async (req, res) => {
  const couponId = req.params.id;
  const { couponName, discount, limit, expiryDate, status } = req.body;
  try {
    // Directly update the coupon if it exists
    const updatedCoupon = await CouponModel.findOneAndUpdate(
      { _id: couponId },
      { couponName, discount, limit, expiryDate, status },
      { new: true }
    );

    if (!updatedCoupon) {
      return res.status(404).send({ error: "Coupon not found" });
    }

    res.send({ message: "Coupon updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});
//DELETE Current Coupon
server.delete("/coupon/:id", async (req, res) => {
  const couponId = req.params.id;
  try {
    // Check if the coupon exists
    const existingCoupon = await CouponModel.findById(couponId);
    if (!existingCoupon) {
      return res.status(404).send({ error: "Coupon not found" });
    }

    // If the coupon exists, delete it
    await CouponModel.findByIdAndDelete(couponId);

    res.send({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

//INDEX Section
// Create INDEX ADMIN populate
server.post("/index", async (req, res) => {
  const { script, link, meta, title, user_id } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new IndexCMS({
      script,
      link,
      meta,
      title,
      user_id,
    });

    // Save the package to the database
    await newPackage.save();

    // Update the user's packages array
    await RegisteradminModal.findByIdAndUpdate(
      user_id,
      { $push: { indexCMS: newPackage._id } },
      { new: true }
    );

    // Send a success response
    res.send("INDEX Created");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// ADMIN all created INDEX
server.get("/index", async (req, res) => {
  try {
    const data = await IndexCMS.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});
//UPDATE Current INDEX
server.put("/updateindex/:id", async (req, res) => {
  const couponId = req.params.id;
  const { script, link, meta, title } = req.body;
  try {
    // Directly update the coupon if it exists
    const updatedCoupon = await IndexCMS.findOneAndUpdate(
      { _id: couponId },
      { script, link, meta, title },
      { new: true }
    );

    if (!updatedCoupon) {
      return res.status(404).send({ error: "Index not found" });
    }

    res.send({ message: "Index updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});
//DELETE Current INDEX
server.delete("/index/:id", async (req, res) => {
  const couponId = req.params.id;
  try {
    // Check if the coupon exists
    const existingCoupon = await IndexCMS.findById(couponId);
    if (!existingCoupon) {
      return res.status(404).send({ error: "Index not found" });
    }

    // If the coupon exists, delete it
    await IndexCMS.findByIdAndDelete(couponId);

    res.send({ message: "Coupon deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// Create Blog CMS ADMIN populate
server.post("/blogcms", async (req, res) => {
  const {
    imageUrl,
    category,
    title,
    description1,

    user_id,
  } = req.body;

  try {
    // Create a new instance of CreatepackageModel
    const newPackage = new BlogcmsModel({
      imageUrl,
      category,
      title,
      description1,

      user_id,
    });

    // Save the package to the database
    await newPackage.save();

    // Update the user's packages array
    await RegisteradminModal.findByIdAndUpdate(
      user_id,
      { $push: { blogcms: newPackage._id } },
      { new: true }
    );

    // Send a success response
    res.send("Blog Created and associated with Admin");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
//  Blog All CMS GET
server.get("/blogcms", async (req, res) => {
  try {
    const data = await BlogcmsModel.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});
// Blog CMS GET by ID
server.get("/blogcms/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const data = await BlogcmsModel.findById(id);
    if (!data) {
      return res.status(404).send("Blog CMS not found");
    }
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// Blog CMS UPDATE by ID
server.put("/blogcms/:id", async (req, res) => {
  const { id } = req.params;
  const {
    imageUrl,
    category,
    title,
    description1,

    user_id,
  } = req.body;

  try {
    // Update the Blog CMS
    const blog = await BlogcmsModel.findByIdAndUpdate(
      id,
      {
        imageUrl,
        category,
        title,
        description1,

        user_id,
      },
      { new: true }
    );
    // Check if the Blog CMS exists
    if (!blog) {
      return res.status(404).send({ error: "Blog not found" });
    }

    res.send({ message: "Blog CMS updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// Blog CMS DELETE by ID
server.delete("/blogcms/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const data = await BlogcmsModel.findByIdAndDelete(id);
    if (!data) {
      return res.status(404).send("Blog CMS not found");
    }
    res.send("Blog deleted successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

//Admin All Order SECTION
//Admin All Orders SECTION
server.post("/allorders-admin", async (req, res) => {
  const { orderID, status } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new AllordersModel({
      orderID,
      status,
    });
    // Save the package to the database
    await newPackage.save();
    // Send a success response
    res.send("item added to orders list");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// GET all Admin All Orders
server.get("/allorders-admin", async (req, res) => {
  try {
    const products = await AllordersModel.find();
    res.send(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Admin All Orders by ID
server.get("/allorders-admin/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await AllordersModel.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Set Tax rate
server.post("/tax", async (req, res) => {
  const { rate, user_id } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new Tax({
      rate,
      user_id,
    });

    // Save the package to the database
    await newPackage.save();

    // Update the user's packages array
    await RegisteradminModal.findByIdAndUpdate(
      user_id,
      { $push: { Tax: newPackage._id } },
      { new: true }
    );

    // Send a success response
    res.send("Tax Created");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// Get Tax rate
server.get("/tax", async (req, res) => {
  try {
    const data = await Tax.find();
    res.send(data);
  } catch (error) {
    res.send(error);
  }
});

// CMS Section
// POST endpoint to create a new footer
server.post("/footer", async (req, res) => {
  const { user_id } = req.body;
  try {
    // Find the existing homecms document for the given user_id
    const existingData = await FooterCMS.findOne({ user_id });
    // Create a new instance of the FooterCMS model with data from the request body
    if (!existingData) {
      const newFooter = new FooterCMS(req.body);
      // Save the new footer to the database
      await newFooter.save();
      // Update the user's packages array
      await RegisteradminModal.findByIdAndUpdate(
        { user_id },
        { $push: { FooterCMS: newFooter._id } },
        { new: true }
      );
    } else {
      // If an existing document is found, update its fields
      await FooterCMS.findOneAndUpdate({ user_id }, req.body, { new: true });
    }
    // Respond with the saved footer
    res.status(201).json({ message: "Footer CMS Updated" });
  } catch (error) {
    // If an error occurs, respond with an error message
    res.status(400).json({ message: error.message });
  }
});
//  Footer CMS GET
server.get("/footer", async (req, res) => {
  try {
    const data = await FooterCMS.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

// General Setting Section
// POST endpoint to create General Setting
server.post("/general-settings", async (req, res) => {
  const { user_id } = req.body;
  try {
    // Find the existing homecms document for the given user_id
    const existingData = await GenaralSetting.findOne({ user_id });
    // Create a new instance of the FooterCMS model with data from the request body
    if (!existingData) {
      const newFooter = new GenaralSetting(req.body);
      // Save the new footer to the database
      await newFooter.save();
      // Update the user's packages array
      await RegisteradminModal.findByIdAndUpdate(
        { user_id },
        { $push: { FooterCMS: newFooter._id } },
        { new: true }
      );
    } else {
      // If an existing document is found, update its fields
      await GenaralSetting.findOneAndUpdate({ user_id }, req.body, {
        new: true,
      });
    }
    // Respond with the saved footer
    res.status(201).json({ message: "General Setting Updated" });
  } catch (error) {
    // If an error occurs, respond with an error message
    res.status(400).json({ message: error.message });
  }
});
// General-settings GET
server.get("/general-settings", async (req, res) => {
  try {
    const data = await GenaralSetting.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

// Set Logo CMS
server.post("/logo", async (req, res) => {
  const { user_id } = req.body;
  try {
    // Find the existing homecms document for the given user_id
    const existingData = await LogoCMS.findOne({ user_id });
    // Create a new instance of the FooterCMS model with data from the request body
    if (!existingData) {
      const newFooter = new LogoCMS(req.body);
      // Save the new logo to the database
      await newFooter.save();
      // Update the user's packages array
      await RegisteradminModal.findByIdAndUpdate(
        { user_id },
        { $push: { LogoCMS: newFooter._id } },
        { new: true }
      );
    } else {
      // If an existing document is found, update its fields
      await LogoCMS.findOneAndUpdate({ user_id }, req.body, { new: true });
    }
    // Respond with the saved logo
    res.status(201).json({ message: "Logo CMS Updated" });
  } catch (error) {
    // If an error occurs, respond with an error message
    res.status(400).json({ message: error.message });
  }
});

// Get Logo CMS
server.get("/logo", async (req, res) => {
  try {
    const data = await LogoCMS.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});

//Client Section
// Client  Register//
server.post("/registerclient", async (req, res) => {
  const { email, password, firstname, lastname, username } = req.body;

  try {
    // Check if the email already exists in the database
    const existingAdvisor = await RegisterclientModal.findOne({
      $or: [{ email: email }, { displayName: username }],
    });

    const registerDate = new Date();

    if (existingAdvisor) {
      // If email already exists, send an error response
      return res.status(400).send("User already exists");
    }
    // Create a new instance of RegisteradvisorModal with the hashed password
    const newData = new RegisterclientModal({
      firstName: firstname,
      lastName: lastname,
      displayName: username,
      password,
      email,
      registerDate,
    });

    // Save the advisor data to the database
    const registered = await newData.save();

    const token = await registered.generateAuthToken();

    // Send a success response
    return res.status(200).json({
      message: "Registered successfully",
      token: token,
      user: {
        _id: registered._id,
        firstName: registered.firstName,
        lastName: registered.lastName,
        email: registered.email,
        username: registered.username,
        registerDate: registered.registerDate,
      },
    });
  } catch (error) {
    // Handle other errors, such as missing details in the request
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

//Client Login
// server.post("/loginclient", async (req, res) => {
//   const { email, password, lastActive } = req.body;
//   try {
//     const user = await RegisterclientModal.findOne({ email });
//     if (user) {
//       bcrypt.compare(password, user.password, (err, result) => {
//         if (result) {
//           // Update lastActive field
//           user.lastActive = lastActive; // assuming lastActive is a timestamp or date
//           user.save(); // save the updated user

//           const token = jwt.sign(
//             {
//               _id: user._id,
//               name: user.name,
//               email: user.email,
//               phone: user.phone,
//             },
//             secret_key
//           );
//           res.json({
//             status: "login successful",
//             token: token,
//             user: {
//               name: user.name,
//               email: user.email,
//               phone: user.phone,
//               _id: user._id,

//               // Add other user details if needed
//             },
//           });
//         } else {
//           res.status(401).json({ status: "wrong entry" });
//         }
//       });
//     } else {
//       res.status(404).json({ status: "user not found" });
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ status: "internal server error" });
//   }
// });

server.post("/loginclient", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(422)
        .json({ message: "Please fill all the fields.", success: false });
    }

    const clientFound = await RegisterclientModal.findOne({ email });

    if (clientFound) {
      const passCheck = await bcrypt.compare(password, clientFound.password);
      const token = await clientFound.generateAuthToken();

      if (passCheck) {
        res.status(200).json({
          status: "login successful",
          token: token,
          user: {
            _id: clientFound._id,
            firstName: clientFound.firstName,
            lastName: clientFound.lastName,
            email: clientFound.email,
            username: clientFound.displayName,
            registerDate: clientFound.registerDate,
          },
        });
      } else {
        res
          .status(401)
          .json({ message: "Invalid login credentials", success: false });
      }
    } else {
      res.status(404).json({ status: "user not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: "internal server error" });
  }
});

server.get("/logout-client", userAuth, async (req, res) => {
  try {
    res
      .status(200)
      .json({ message: "logged out successfully!", success: true });
  } catch (e) {
    res.status(500).send(e);
  }
});

//Update Client Detail
server.put("/updateclient", userAuth, async (req, res) => {
  const {
    firstName,
    lastName,
    displayName,
    phone,
    zipcode,
    email,
    oldPassword,
    newPassword,
  } = req.body;

  try {
    // Find user by ID
    const user = await RegisterclientModal.findById(req.rootUser._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let updateData = {
      firstName,
      lastName,
      displayName,
      email,
      phone,
      zipcode,
    };

    if (oldPassword && newPassword) {
      // Compare old password
      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!passwordMatch) {
        return res.status(400).json({ error: "Old password is incorrect" });
      }

      // Hash the new password if provided
      let hashedPassword = user.password; // default to old hashed password
      if (newPassword) {
        hashedPassword = await bcrypt.hash(newPassword, 10);
      }

      updateData = {
        firstName,
        lastName,
        displayName,
        email,
        password: hashedPassword,
        phone,
        zipcode,
      };
    } else if ((oldPassword && !newPassword) || (newPassword && !oldPassword)) {
      return res
        .status(400)
        .json({ error: "Both old and new passwords are required." });
    }

    // Update user details
    const updatedUser = await RegisterclientModal.findByIdAndUpdate(
      req.rootUser._id,
      updateData,
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Optionally, you can return the updated user as JSON
    res.json("Updated user details successfully");
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Server error" });
  }
});
//Get all clients
server.get("/getclients", async (req, res) => {
  try {
    const clients = await RegisterclientModal.find();
    res.send(clients);
  } catch (error) {
    console.log(error);
    res.status(500).send("Error retrieving clients");
  }
});

//Account Details Section From Client
// Create Account Details Client populate
server.post("/account-details-client", async (req, res) => {
  const { firstName, lastName, displayName, user_id } = req.body;

  try {
    // Find the existing homecms document for the given user_id
    const existingPackage = await AccountdetailModel.findOne({ user_id });

    if (!existingPackage) {
      // If no existing document, create a new one
      const newPackage = new AccountdetailModel({
        firstName,
        lastName,
        displayName,
        user_id,
      });

      // Save the new document to the database
      await newPackage.save();

      // Update the user's details array
      await RegisterclientModal.findByIdAndUpdate(
        user_id,
        { $push: { accountdetail: newPackage._id } },
        { new: true }
      );
    } else {
      // If an existing document is found, update its fields
      await AccountdetailModel.findOneAndUpdate(
        { user_id },
        {
          firstName,
          lastName,
          displayName,
        },
        { new: true }
      );
    }

    // Send a success response
    res.send("Account Details added/updated successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// Client GET account details
server.get("/account-details-client/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await RegisterclientModal.findById(id).populate(
      "accountdetail"
    );
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

server.get("/get-client-basic-details", userAuth, async (req, res) => {
  try {
    const userFound = await RegisterclientModal.findById(req.rootUser._id);
    if (!userFound) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }

    return res.status(200).json({
      message: "User fetched",
      success: true,
      user: {
        firstname: userFound.firstName,
        lastname: userFound.lastName,
        username: userFound.username,
        phone: userFound?.phone,
        zipcode: userFound?.zipcode,
        email: userFound.email,
        registerDate: userFound.registerDate,
      },
    });
  } catch (e) {
    console.log(e);
    return res.status(500).send("Internal Server Error");
  }
});

//Address Book Details Section From Client
// Create Address Book Details Client populate
server.post("/addressbookbilling", async (req, res) => {
  const {
    billingfirstName,
    billinglastName,
    billingcountry,
    billingstreetAddress,
    billingcity,
    billingstate,
    billingzipcode,
    billingphone,
    billingemail,
    user_id,
  } = req.body;

  try {
    const existingPackage = await AddressbookBillingModel.findOne({ user_id });
    // Create a new instance of AdvisorpackageModel
    if (!existingPackage) {
      const newPackage = new AddressbookBillingModel({
        billingfirstName,
        billinglastName,
        billingcountry,
        billingstreetAddress,
        billingcity,
        billingstate,
        billingzipcode,
        billingphone,
        billingemail,
        user_id,
      });

      // Save the package to the database
      await newPackage.save();

      // Update the user's packages array
      await RegisterclientModal.findByIdAndUpdate(
        user_id,
        { $push: { addressbookbilling: newPackage._id } },
        { new: true }
      );
    } else {
      await AddressbookBillingModel.findOneAndUpdate(
        { user_id },
        {
          billingfirstName,
          billinglastName,
          billingcountry,
          billingstreetAddress,
          billingcity,
          billingstate,
          billingzipcode,
          billingphone,
          billingemail,
        },
        { new: true }
      );
    }

    // Send a success response
    res.send("Billing Address Created");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
server.post("/addressbookshipping", async (req, res) => {
  const {
    shippingfirstName,
    shippinglastName,
    shippingcountry,
    shippingstreetAddress,
    shippingcity,
    shippingstate,
    shippingzipcode,
    shippingphone,
    user_id,
  } = req.body;

  try {
    const existingPackage = await AddressBookShippingModel.findOne({ user_id });

    if (!existingPackage) {
      // Create a new instance of AdvisorpackageModel
      const newPackage = new AddressBookShippingModel({
        shippingfirstName,
        shippinglastName,
        shippingcountry,
        shippingstreetAddress,
        shippingcity,
        shippingstate,
        shippingzipcode,
        shippingphone,
        user_id,
      });

      // Save the package to the database
      await newPackage.save();

      // Update the user's packages array
      await RegisterclientModal.findByIdAndUpdate(
        user_id,
        { $push: { addressbookShipping: newPackage._id } },
        { new: true }
      );
    } else {
      await AddressBookShippingModel.findOneAndUpdate(
        { user_id },
        {
          shippingfirstName,
          shippinglastName,
          shippingcountry,
          shippingstreetAddress,
          shippingcity,
          shippingstate,
          shippingzipcode,
          shippingphone,
        },
        { new: true }
      );
    }
    // Send a success response
    res.send("Shipping Address Created/updated");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// Client all created Address Book Details
server.get("/addressbookbilling/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await RegisterclientModal.findById(id).populate(
      "addressbookbilling"
    );
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});
// Client all created Address Book Details
server.get("/addressbookshipping/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await RegisterclientModal.findById(id).populate(
      "addressbookShipping"
    );
    res.send(data);
  } catch (error) {
    console.log(error);
    res.send(error);
  }
});
//UPDATE Current Address Book Details
server.put("/update-addressbook/:id", async (req, res) => {
  const couponId = req.params.id;
  const {
    billingfirstName,
    billinglastName,
    billingcountry,
    billingstreetAddress,
    billingcity,
    billingstate,
    billingzipcode,
    billingphone,
    billingemail,
    shippingfirstName,
    shippinglastName,
    shippingcountry,
    shippingstreetAddress,
    shippingcity,
    shippingstate,
    shippingzipcode,
    shippingphone,
  } = req.body;
  try {
    // Directly update the coupon if it exists
    const updatedCoupon = await AddressbookModel.findOneAndUpdate(
      { _id: couponId },
      {
        billingAddress: [
          billingfirstName,
          billinglastName,
          billingcountry,
          billingstreetAddress,
          billingcity,
          billingstate,
          billingzipcode,
          billingphone,
          billingemail,
        ],
        shippingAddress: [
          shippingfirstName,
          shippinglastName,
          shippingcountry,
          shippingstreetAddress,
          shippingcity,
          shippingstate,
          shippingzipcode,
          shippingphone,
        ],
      },
      { new: true }
    );

    if (!updatedCoupon) {
      return res.status(404).send({ error: "address not found" });
    }

    res.send({ message: "address updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});
//DELETE Current Address Book Details
server.delete("/addressbookbilling/:id", async (req, res) => {
  const user_id = req.params.id;
  try {
    // Check if the coupon exists
    const existingCoupon = await AddressbookBillingModel.findByIdAndDelete(
      user_id
    );
    if (!existingCoupon) {
      return res.status(404).send({ error: "Billing address not found" });
    }

    res.send({ message: "Billing address deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});
//DELETE Current Address Book Details
server.delete("/addressbookshipping/:id", async (req, res) => {
  const user_id = req.params.id;
  try {
    // Check if the coupon exists
    const existingCoupon = await AddressBookShippingModel.findByIdAndDelete(
      user_id
    );
    if (!existingCoupon) {
      return res.status(404).send({ error: "Shipping address not found" });
    }

    res.send({ message: "Shipping address deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

//Order Section For Client
// Create Order Client populate
server.post("/order", async (req, res) => {
  const {
    image,
    title,
    price,
    qty,
    billing,
    shipping,
    product_id,
    user,
    user_id,
    ip,
    createdDate,
    status,
    totalpay,
  } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new OrderModal({
      image,
      title,
      price,
      qty,
      billing,
      shipping,
      product_id,
      user,
      user_id,
      ip,
      createdDate,
      status,
      totalpay,
    });

    // Save the package to the database
    await newPackage.save();

    // Update the user's packages array
    await RegisterclientModal.findByIdAndUpdate(
      user_id,
      { $push: { order: newPackage._id } },
      { new: true }
    );

    // Send a success response
    res.send("order placed");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
//Update order
server.put("/order/:orderId", async (req, res) => {
  const orderId = req.params.orderId;
  const { status } = req.body;

  try {
    // Update the status field in the existing document
    const updatedOrder = await OrderModal.findByIdAndUpdate(
      orderId,
      { $set: { status: status } },
      { new: true }
    );

    if (!updatedOrder) {
      return res.status(404).send("Order not found");
    }

    // Send the updated order as a response
    res.json(updatedOrder);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
//Populate Order for client
server.get("/order/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await RegisterclientModal.findById(id).populate("order");
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// Get all orders
server.get("/order", async (req, res) => {
  try {
    const data = await OrderModal.find();
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// Get order by order id
server.get("/specific-order/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await OrderModal.findById(id);
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

//Wishlist Section For Client
// Create Wishlist Client populate
server.post("/wishlist", userAuth, async (req, res) => {
  const { image, title, price, qty, product_id } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new WishlistModal({
      image,
      title,
      price,
      qty,
      product_id,
      user_id: req.rootUser._id,
    });

    // Save the package to the database
    await newPackage.save();

    // Update the user's packages array
    await RegisterclientModal.findByIdAndUpdate(
      req.rootUser._id,
      { $push: { wishlist: newPackage._id } },
      { new: true }
    );

    // Send a success response
    res.send("Product added to cart");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

// Get User's Cart
server.get("/get-user-cart", userAuth, async (req, res) => {
  const userId = req.rootUser._id; // Assume user ID is retrieved from token using middleware
  try {
    // Fetch the user's cart (wishlist) based on their user ID
    const userCart = await WishlistModal.find({ user_id: userId });

    // Check if the cart exists
    if (!userCart || userCart.length === 0) {
      return res.status(404).json({ message: "Cart is empty" });
    }

    // Group products by product_id and sum quantities
    const groupedCart = userCart.reduce((acc, item) => {
      const existingItem = acc.find(cartItem => cartItem.product_id === item.product_id);
      if (existingItem) {
        existingItem.qty += item.qty; // Combine the quantities if the product already exists
      } else {
        acc.push({ ...item.toObject() }); // Push a new item if not present
      }
      return acc;
    }, []);

    // Return the cart data
    res.status(200).json({
      success: true,
      cart: groupedCart,
    });
  } catch (error) {
    console.error("Error fetching user's cart:", error);
    res.status(500).json({ message: "Server error, please try again later." });
  }
});


//Populate Order for client
server.get("/wishlist/:id", userAuth, async (req, res) => {
  try {
    const data = await RegisterclientModal.findOne({user_id: req.rootUser._id}).populate("wishlist");
    res.send(data);
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

// Delete wishlist by id
server.delete("/wishlist/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await WishlistModal.findByIdAndDelete(id);
    res.send("Product removed from cart");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

//Inventory SECTION
server.post("/inv-products", async (req, res) => {
  const { image, title, description, price, category, stock, review } =
    req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new InventoryroductModal({
      image,
      title,
      description,
      price,
      category,
      stock,
      review,
    });
    // Save the package to the database
    await newPackage.save();
    // Send a success response
    res.send("product created successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// GET all products
server.get("/inv-products", async (req, res) => {
  try {
    const products = await InventoryroductModal.find();
    res.send(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product by product by ID
server.get("/inv-products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await InventoryroductModal.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product byID & DELETE
server.delete("/inv-products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await InventoryroductModal.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

server.put("/inv-products/:id", async (req, res) => {
  const productId = req.params.id;
  const updateData = req.body;

  try {
    const updatedProduct = await InventoryroductModal.findByIdAndUpdate(
      productId,
      updateData,
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: " inventory updated successfully", updatedProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//Featured SECTION
server.post("/feature-products", async (req, res) => {
  const {
    image,
    title,
    description,
    category,
    price,
    stock,
    year,
    cutting,
    grade,
    region,
    color,
    leaf,
    bleach,
    texture,
    steamSize,
  } = req.body;

  try {
    // Create a new instance of AdvisorpackageModel
    const newPackage = new FeaturedpoductModal({
      image,
      title,
      description,
      category,
      price,
      stock,
      year,
      cutting,
      grade,
      region,
      color,
      leaf,
      bleach,
      texture,
      steamSize,
    });
    // Save the package to the database
    await newPackage.save();
    // Send a success response
    res.send("product created successfully");
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});
// GET all products
server.get("/feature-products", async (req, res) => {
  try {
    const products = await FeaturedpoductModal.find();
    res.send(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product by product by ID
server.get("/feature-products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await FeaturedpoductModal.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET Product byID & DELETE
server.delete("/feature-products/:id", async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await FeaturedpoductModal.findByIdAndDelete(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

server.put("/feature-products/:id", async (req, res) => {
  const productId = req.params.id;
  const updateData = req.body;

  try {
    const updatedProduct = await FeaturedpoductModal.findByIdAndUpdate(
      productId,
      updateData,
      { new: true }
    );
    if (!updatedProduct) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ message: " inventory updated successfully", updatedProduct });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

//SERVER
//server running
server.listen(Port, async () => {
  try {
    console.log(`server running at port ${Port}`);
  } catch (error) {
    console.log(error);
  }
});
