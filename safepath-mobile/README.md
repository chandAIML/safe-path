# SafePath Mobile — Login & Signup Starter

## How to run

```bash
cd safepath-mobile
npm install
npx expo start
```

A QR code appears in the terminal. Scan it with the **Expo Go** app on your phone
(install Expo Go from Play Store / App Store first).

## Before running: connect to your backend

Open `screens/LoginScreen.js` and `screens/SignupScreen.js`, and check the `API_URL`:

- Testing on an **Android emulator** → keep `http://10.0.2.2:3000`
- Testing on a **real phone** via Expo Go → change it to your computer's local IP,
  e.g. `http://192.168.1.5:3000` (find it with `ipconfig` on Windows or `ifconfig` on Mac/Linux).
  Your phone and computer must be on the same Wi-Fi network.

Make sure the backend (`safepath_backend.zip` → `node server.js`) is running at the same time.

## What's included

- `App.js` — navigation setup (Login ↔ Signup)
- `screens/LoginScreen.js` — login form, calls `POST /api/auth/login`
- `screens/SignupScreen.js` — signup form, calls `POST /api/auth/signup`

## Testing it

1. Run the backend first.
2. Run this app, open Signup, create an account with your name/phone/password.
3. You should see "Account created" and get sent to Login.
4. Log in with the same phone number + password — you should see "Welcome back".

This screenshot (signup + login working on your phone) is solid Week 3 proof.
