# Wordwrap — Build Brief

## Project Overview

A web-based daily word game called **Wordwrap**. A new puzzle is released each day; past puzzles are available in an archive. User accounts and streak tracking are supported from day one.

---

## Architecture

### Hosting
- **Firebase Hosting** serves the frontend (HTML/CSS/JS)
- Source code lives in a **private GitHub repository**
- **GitHub Actions** deploys to Firebase Hosting on every push to `main`

### Puzzle Delivery
- **Firestore** stores all puzzles upfront, each as a document keyed by date (`YYYY-MM-DD`)
- **Firestore security rules** use `request.time` (server-side clock, not spoofable) to gate reads — clients can only fetch today's puzzle or past puzzles, never future ones
- The frontend fetches the puzzle for a given date directly from Firestore

### User Accounts & Streaks
- **Firebase Authentication** (Google sign-in as a minimum)
- **Firestore** stores per-user data (streak, history) in a `users` collection, locked to each user via security rules

---

## Puzzle Data

Each puzzle is pre-generated locally and loaded into Firestore upfront. The puzzle generation logic and source board data are kept private and are **not** part of the deployed frontend.

Each Firestore document in the `puzzles` collection looks like:

```json
{
  "date": "2026-02-10",
  "publishDate": "<Firestore Timestamp for midnight UTC on that date>",
  "board": "<board identifier or serialised starting position>",
  "solution": "<solution data>"
}
```

The document ID is the date string: `2026-02-10`.

---

## Firestore Security Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Puzzles: readable only if publishDate is now or in the past
    match /puzzles/{date} {
      allow read: if resource.data.publishDate <= request.time;
      allow write: if false; // only writable via Admin SDK / Firebase Console
    }

    // Users: each user can only read/write their own document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Frontend Structure

```
src/
  index.html
  app.js          ← entry point, routes between today/archive
  game.js         ← core game logic
  auth.js         ← Firebase Auth (sign in/out, auth state)
  streaks.js      ← read/write streak data to Firestore
  firebase.js     ← Firebase app initialisation and config
```

### Fetching Today's Puzzle

```js
import { db } from './firebase.js';
import { doc, getDoc } from 'firebase/firestore';

const today = new Date().toISOString().slice(0, 10); // "2026-02-10"

const snap = await getDoc(doc(db, 'puzzles', today));
if (!snap.exists()) {
  showError('No puzzle available yet.');
  return;
}
const puzzle = snap.data();
startGame(puzzle);
```

### Archive

Allow the user to pick any past date and fetch the same way. Firestore rules allow it because the date is in the past.

### Auth

```js
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';

const auth = getAuth();

export function signIn() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function onUserChange(callback) {
  return onAuthStateChanged(auth, callback);
}
```

### Streak Tracking

```js
import { db } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function recordResult(userId, date, won) {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : { streak: 0, lastPlayed: null, history: {} };

  const yesterday = getPreviousDateString(date); // implement this helper
  const newStreak = won && data.lastPlayed === yesterday
    ? data.streak + 1
    : won ? 1 : 0;

  await setDoc(ref, {
    streak: newStreak,
    lastPlayed: date,
    history: { ...data.history, [date]: { won } }
  }, { merge: true });
}
```

---

## GitHub Actions — Deploy to Firebase

```yaml
# .github/workflows/deploy.yml
name: Deploy to Firebase Hosting

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: ${{ secrets.GITHUB_TOKEN }}
          firebaseServiceAccount: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          channelId: live
```

Store the Firebase service account JSON as the `FIREBASE_SERVICE_ACCOUNT` secret in the GitHub repo settings.

---

## Setup Checklist

1. Create a Firebase project
2. Enable **Firestore** in production mode
3. Enable **Firebase Authentication** — turn on Google provider
4. Enable **Firebase Hosting**
5. Apply the Firestore security rules above
6. Pre-generate all puzzle documents and upload to Firestore (via a local Admin SDK script or the Firebase Console)
7. Create a private GitHub repo, add Firebase config to the frontend (`firebase.js`)
8. Generate a Firebase service account key, add it as `FIREBASE_SERVICE_ACCOUNT` in GitHub repo secrets
9. Push to `main` — GitHub Actions deploys automatically

---

## Important Notes

- **`request.time` is server-side** — it cannot be spoofed by the client. Firestore evaluates security rules on Google's infrastructure.
- **Puzzle generation code and board data should never be committed to this repo** — keep them in a separate private location. Only the pre-generated puzzle JSON is loaded into Firestore.
- **Timezone:** `publishDate` timestamps should be set to midnight in your chosen release timezone (e.g. midnight UTC). Be consistent.
- **No Cloud Functions required** — the entire setup runs on Firebase's free Spark tier.
