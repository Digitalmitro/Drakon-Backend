const jwt = require("jsonwebtoken");
const {
  RegisteradminModal,
} = require("../AdminModel/RegisterAdminModel");

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.token;
    const verifyToken = jwt.verify(token, process.env.secret_key);

    console.log(verifyToken);

    const rootUser = await RegisteradminModal.findOne({ _id: verifyToken._id });


    console.log(rootUser);

    if (!rootUser) {
      throw new Error("Admin Not Found.");
    }

    req.token = token;
    req.rootUser = rootUser;

    next();
  } catch (error) {
    res.status(401).send("Unauthorized : No token provided");
    console.log(error);
  }
};

module.exports = adminAuth;

