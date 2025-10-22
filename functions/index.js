const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.getUserByPhone = functions.https.onCall(async (data) => {
  const phone = data.phone;
  if (!phone) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Phone required"
    );
  }

  const snapshot = await admin
    .firestore()
    .collection("betting")
    .where("phone", "==", phone)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new functions.https.HttpsError("not-found", "No user found");
  }

  return {email: snapshot.docs[0].data().email};
});
