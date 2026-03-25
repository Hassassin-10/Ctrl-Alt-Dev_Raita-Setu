const admin = require('firebase-admin');

// Initialize Firebase Admin SDK using environment variables
// (Avoids needing to store the serviceAccountKey.json file in the repo)
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const db = admin.firestore();

module.exports = { admin, db };
