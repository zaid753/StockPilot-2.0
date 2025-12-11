📦 StockPilot v2.0 — Voice-Enabled Inventory Management System
🏆 Winner — HackFest 2.0 (1st Position)
Built by Team SoundSync
StockPilot v2.0 is an upgraded, production-ready, voice-enabled inventory management platform designed to empower small shop owners with hands-free, real-time, and intuitive inventory control.
It transforms inventory tracking into something as simple as speaking — no typing, no complex apps, and no technical expertise required.

With support for English + Hindi commands, smart analytics, multi-user real-time sync, and an improved dashboard, StockPilot v2.0 redefines how local retailers manage their daily operations.

🌟 Key Highlights
🥇 1st Place Winner at HackFest 2.0

🎙️ Voice-first inventory control

🔄 Real-time multi-user sync

📊 Smart dashboard with insights & analytics

🧠 Natural Hindi + English command understanding

⚡ Runs fully in the browser — no installation required

📱 Mobile-first responsive interface

⏱️ Designed for busy shopkeepers with low tech familiarity

🚩 Problem Statement
Small retailers often rely on notebooks or complicated digital tools that interrupt their workflow.
Common challenges include:

Difficulty updating stock while serving customers

Language barriers & lack of digital literacy

Errors in stock entry leading to financial loss

No instant visibility on stock levels or reorder needs

Lack of real-time staff collaboration

There is a pressing need for a simple, hands-free, and accessible solution that fits naturally into their daily routine.

💡 Our Solution
StockPilot v2.0 brings voice-based inventory management directly into the browser, enabling shopkeepers to:

Add items
“Add 10 Pepsi”

Remove items
“Remove 2 bread packets”

Check availability
“Check stock for Maggie”

Get alerts
“Low stock on items”

View visual insights
Stock charts, demand patterns, and reorder recommendations

This makes the entire process fast, natural, and human-friendly, especially for non-technical users.

✨ What’s New in StockPilot v2.0
Compared to the earlier version, v2.0 introduces several major improvements:

🆕 1. Smart Inventory Dashboard
Overall stock view

Category-based segmentation

Low-stock indicators

Visual consumption patterns

🆕 2. Enhanced Voice Engine
Better recognition of Hinglish commands

Noise-tolerant voice processing

Faster command execution

🆕 3. Multi-User Real-Time Sync
Owners + staff can update inventory simultaneously

Instant reflection across connected devices

🆕 4. Product Management Features
Image upload for product catalog

Category creation

Price & SKU management

🆕 5. Sales & Purchase History
Track daily sales

Maintain purchase logs

Generate summaries for analysis

🆕 6. Low-Stock Alerts + Auto Reorder Suggestions
Threshold-based alerts

Recommended reorder quantities

🆕 7. Modern UI/UX
Clean, responsive interface

Mobile-first layout

Smooth onboarding experience

🧠 Tech Stack
Frontend
React / TypeScript

Vite

Tailwind CSS

Core Services
Voice Understanding Engine (custom integration)

Firebase Firestore — real-time database

Firebase Auth — secure access

Firebase Storage — product images

Agora RTM — real-time communication layer

Tools & Architecture
WebRTC-based voice capture

REST API integrations

Modular component structure

Optimized state management

⚙️ How StockPilot Works
User speaks a command → e.g., “Add five Coke”

Voice engine converts speech into structured intent

Inventory logic processes the command

Firestore updates the database in real time

UI auto-refreshes with the latest values

Dashboard & analytics update accordingly

Everything happens within seconds, without typing or manual data entry.

📈 Impact & Real-World Value
StockPilot v2.0 helps small shop owners:

Save time during busy hours

Avoid stockouts & missed reorders

Reduce human error

Improve decision-making with insights

Easily adopt digital inventory tools without training

It bridges the gap between technology and real ground-level retail challenges.

📦 Project Structure
css
Copy code
src/
  components/
    InventoryManager.tsx
    CreateInvoiceModal.tsx
    Dashboard/
      StockCharts.tsx
      Insights.tsx
  pages/
    Home.tsx
    AdminDashboard.tsx
  utils/
    speechHandler.ts
    inventoryLogic.ts
    firebaseConfig.ts
  assets/
    productImages/
🚀 Getting Started
Installation
bash
Copy code
npm install
Run Development Server
bash
Copy code
npm run dev
Build for Production
bash
Copy code
npm run build
Preview Build
bash
Copy code
npm run preview
