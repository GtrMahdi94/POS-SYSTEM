# DECC POS Full System

This package is a full starter system built from your uploaded DECC files:
- products imported from the PDF report
- sellers and category options taken from the Excel workbook

## What's inside

- `frontend/` → React + Vite POS interface
- `backend/` → Express API + JSON database
- `backend/data/products.json` → imported product database
- `backend/data/invoices.json` → saved invoices
- `backend/data/meta.json` → sellers + categories

## Features

- Arabic POS screen
- seller selection
- customer name
- payment method
- product search
- category filtering
- shopping cart
- invoice saving
- stock deduction after sale
- reports summary
- printable invoice screen

## How to run

### 1) Start backend
Open terminal inside `backend` and run:

```bash
npm install
npm run dev
```

Backend runs on:
`http://localhost:4000`

### 2) Start frontend
Open a second terminal inside `frontend` and run:

```bash
npm install
npm run dev
```

Frontend runs on:
`http://localhost:5173`

## Important

This uses **Vite**, not `react-scripts`, so it avoids the error you got before.

## Notes

- Data is stored in JSON files for simplicity.
- Every saved invoice updates product stock in `backend/data/products.json`.
- You can later move this to MongoDB or MySQL.


Updated theme: black/gold/white; daily closing and PDF print added.
