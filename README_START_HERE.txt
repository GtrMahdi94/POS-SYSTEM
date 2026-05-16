ALMALAKI / الملكي POS FINAL

1) Install Node.js LTS first: https://nodejs.org
2) Make Firebase Realtime Database rules temporarily:
{
  "rules": { ".read": true, ".write": true }
}
3) Double-click start-pos.bat
4) Open http://localhost:5173

First run installs packages and uploads local products + sellers to Firebase.
Next runs start frontend/backend automatically.

Important files:
- frontend/src/firebase.js
- frontend/src/services/firebaseDb.js
- backend/data/products.json
- backend/data/meta.json
