const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// GET /api/farmers/:uid → Fetch a farmer profile from Firestore
router.get('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const doc = await db.collection('farmers').doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Farmer not found' });
    }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/farmers/:uid → Create or update a farmer profile
router.post('/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const profileData = req.body;

    await db.collection('farmers').doc(uid).set(profileData, { merge: true });
    res.status(200).json({ message: 'Farmer profile saved successfully', uid });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/farmers → List all farmers (admin use)
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('farmers').limit(50).get();
    const farmers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(farmers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
