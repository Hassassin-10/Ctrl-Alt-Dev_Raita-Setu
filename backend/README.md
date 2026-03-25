# Raitha Setu – Backend API

A lightweight **Node.js + Express** REST API that powers the backend logic for Raitha Setu.

## 📁 Structure

```
backend/
├── src/
│   ├── index.js          ← Express server entry point
│   ├── firebase.js       ← Firebase Admin SDK setup
│   └── routes/
│       ├── farmers.js    ← Farmer profile CRUD
│       ├── schemes.js    ← AI-powered Govt Scheme explanations
│       └── market.js     ← Machinery/Labor marketplace & bookings
├── .env.example          ← Copy to .env and fill values
└── package.json
```

## 🚀 Getting Started

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Set up environment variables
```bash
copy .env.example .env
```
Then fill in your `.env`:
- `GEMINI_API_KEY` → Your Google AI Studio key
- Firebase Admin credentials from Firebase Console → Project Settings → Service Accounts

### 3. Start the dev server
```bash
npm run dev
```
Server starts at **http://localhost:5000**

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check & endpoint listing |
| GET | `/api/farmers/:uid` | Get farmer profile |
| POST | `/api/farmers/:uid` | Save farmer profile |
| GET | `/api/schemes/list` | AI-generated scheme list |
| POST | `/api/schemes/ask` | Ask AI about a scheme |
| GET | `/api/market/listings` | Get marketplace listings |
| POST | `/api/market/book` | Book machinery or labor |
| GET | `/api/market/bookings/:farmerUid` | Get farmer's bookings |
