const mongoose = require('mongoose');

const footerSchema = new mongoose.Schema({
  features: {
    feature1: String,
    feature2: String,
    feature3: String
  },
  socialLinks: {
    socialLink1: String,
    socialLink2: String,
    socialLink3: String,
    socialLink4: String
  },
  category1: {
    title: String,
    item1: String,
    item2: String,
    item3: String,
    item4: String,
    item5: String,
    item6: String,
    item7: String,
    item8: String,
    item9: String,
    item10: String,
    item11: String
  },
  copyright: {
    type: String
  },

  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register admin",
    required: true,
  },
});

const FooterCMS = mongoose.model('FooterCMS', footerSchema);

module.exports = FooterCMS;
