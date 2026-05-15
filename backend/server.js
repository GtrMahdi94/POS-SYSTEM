import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.get('/api/health', (_req, res) => res.json({ ok: true, message: 'backend running', time: new Date().toISOString() }));
app.listen(PORT, () => console.log(`POS backend listening on http://localhost:${PORT}`));
