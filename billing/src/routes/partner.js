const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * Create a new customer
 * @name POST /partner/create
 * @param {string} country  country of the partner business
 * @param {string} email    email of the partner
 * @param {string} businessType business type of the partner
 * @param {string} company info of the partner company or business
 * @param {string} individual info of the person represented by the account
 * @returns {object} Boolean
 */
router.post("/create", express.json(), async (req, res) => {
  try {
    const { country, email, businessType, company, individual } = req.body;

    const accountType = "standard";
    const account = await stripe.accounts.create({
      type: accountType,
      country: country,
      email: email,
      business_type: businessType,
    });
    
      // save stripe's customer.id as customerID in db
      await db
      .collection("billingCustomerAccounts")
      .doc(userAccountID.toString()) // As userAccountID is a number, WE MUST CONVERT it to string first, as firestore NEEDS string for document path!!!
      .set({ customerID: customer.id });

      
    res.status(201).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
