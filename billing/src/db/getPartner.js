const db = require("./../utils/db.js");

// Get stripe partner Connect Account ID using partner's account ID from DB
async function getStripePartnerID(partnerAccountID) {
  const snapshot = await db
    .collection("billingPartnerAccounts")
    .doc(partnerAccountID.toString())
    .get();

  if (snapshot.empty) return;

  return snapshot.data().partnerID;
}

module.exports = getStripePartnerID;
