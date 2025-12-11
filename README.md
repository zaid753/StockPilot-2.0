📦 StockPilot v2.0 — Voice-Enabled Inventory Management System
🏆 1st Place Winner — HackFest 2.0
👥 Built by Team SoundSync
StockPilot v2.0 is an advanced voice-enabled inventory management system designed to make stock handling effortless for small shop owners. With support for Hindi + English voice commands, real-time updates, multi-user access, and a modern analytics dashboard, StockPilot delivers a seamless and intuitive experience—without requiring any technical skills or installations.

🔍 Overview
Small retailers often struggle with manual stock updates, complex applications, and language barriers. StockPilot v2.0 solves these challenges by enabling shopkeepers to manage inventory simply by speaking, allowing for faster, more accurate, and hands-free operations.

🌟 Key Features
🎤 Voice-Driven Inventory Control
Add, remove, and check stock using natural voice commands

Supports both English and Hindi conversational input

📊 Smart Dashboard & Insights
Real-time visual stock overview

Category-wise segmentation

Fast-moving & low-stock indicators

🔄 Real-Time Multi-User Sync
Multiple staff members can update stock simultaneously

Instant data reflection across all connected devices

🧠 Enhanced NLP Voice Engine
Improved recognition for Hinglish commands

Faster processing in noisy shop environments

📂 Product & Catalog Management
Add/edit items with images, categories, pricing, and SKUs

Maintain purchase and sales history

🚨 Alerts & Notifications
Low-stock alerts

Automated reorder recommendations based on usage patterns

📱 Modern UI/UX
Fully responsive and mobile-first design

Clean, intuitive interface with minimal learning curve

⚙️ Tech Stack
Frontend
React

TypeScript

Vite

Tailwind CSS

Backend & Cloud Services
Firebase Firestore (Realtime Database)

Firebase Auth (Secure Authentication)

Firebase Storage (Product Images)

Agora RTM (Realtime Communication Layer)

Additional Tools
WebRTC for voice capture

Custom speech processing utilities

Modular state & inventory logic

🧩 How It Works
User speaks a command (e.g., “Add 5 Pepsi”)

Voice engine interprets the command and extracts intent

Firestore updates inventory in real time

Dashboard immediately reflects updated stock levels

Alerts, insights, and logs update automatically

🗂️ Folder Structure
plaintext
Copy code
src/
  components/
    InventoryManager.tsx
    CreateInvoiceModal.tsx
    Dashboard/
      Insights.tsx
      StockCharts.tsx
  pages/
    Home.tsx
    AdminDashboard.tsx
  utils/
    firebaseConfig.ts
    inventoryLogic.ts
    speechHandler.ts
  assets/
    productImages/
🚀 Getting Started
1. Install Dependencies
bash
Copy code
npm install
2. Run Development Server
bash
Copy code
npm run dev
3. Build for Production
bash
Copy code
npm run build
4. Preview Production Build
bash
Copy code
npm run preview
📈 Impact
Saves time and simplifies routine stock updates

Removes dependency on typing and complex software

Reduces errors and stock mismanagement

Supports non-tech-savvy users thanks to voice-first design

Helps shops operate more efficiently with real-time insights

🏆 Achievements
Winner — HackFest 2.0 (1st Position)

Recognized for impactful innovation, usability, and real-world relevance

Demonstrates strong scalability and production-friendly design
