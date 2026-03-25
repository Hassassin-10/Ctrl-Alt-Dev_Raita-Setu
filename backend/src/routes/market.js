const express = require('express');
const router = express.Router();
const { db } = require('../firebase');

// GET /api/market/listings → Fetch all machinery/labor listings
router.get('/listings', async (req, res) => {
  try {
    const snapshot = await db.collection('market_listings').get();
    const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/market/book → Book a machinery or labor listing
router.post('/book', async (req, res) => {
  try {
    const { farmerUid, listingId, listingTitle, bookingDate } = req.body;

    if (!farmerUid || !listingId) {
      return res.status(400).json({ error: 'farmerUid and listingId are required' });
    }

    const booking = {
      farmerUid,
      listingId, 
      listingTitle,
      bookingDate: bookingDate || new Date().toISOString(),
      status: 'confirmed',
      createdAt: new Date().toISOString(), 
    };

    const ref = await db.collection('bookings').add(booking);
    res.status(201).json({ message: 'Booking confirmed!', bookingId: ref.id, ...booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/market/bookings/:farmerUid → Get bookings for a specific farmer
router.get('/bookings/:farmerUid', async (req, res) => {
  try {
    const { farmerUid } = req.params;
    const snapshot = await db.collection('bookings').where('farmerUid', '==', farmerUid).get();
    const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
