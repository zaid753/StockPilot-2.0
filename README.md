📦 StockPilot v2.0 — AI-Powered Voice-Based Inventory & Shop Management

🏆 Winner — HackFest 2.0

👥 Built by Team SoundSync

StockPilot v2.0 is an AI-powered, voice-first inventory and shop management system designed for small shopkeepers and suppliers.
It allows users to talk to their store — using Hindi, English, or Hinglish — to manage stock, analyze shelves, digitize items, check expiry, generate insights, and collaborate with suppliers in real time.

Built using React + TypeScript + Firebase, StockPilot v2.0 is fully browser-based, fast, intuitive, and engineered for real-world usability.
______
✨ Problem Statements We Address
Challenges Faced by Shopkeepers 
Sound Sync_1 (Nitish Yadav)

Manual register-based inventory → frequent errors

No real-time visibility of low-stock or soon-expiring items

Losses due to over-stock, under-stock, and expired products

Digital tools are often complex and not user-friendly

Time-consuming updates during busy shop hours

Challenges Faced by Suppliers
No streamlined system to connect with shopkeepers

No real-time view of store requirements

Hard to track orders, profit/loss, and stock

No central communication platform for sellers ↔ suppliers

_____
🚀 Our Solution – StockPilot v2.0
StockPilot is an AI Co-Pilot for shopkeepers and suppliers.
Users can speak, scan, or record videos to manage their entire store effortlessly.

Core Highlights
🎤 Voice-first inventory management

📸 AI-powered item & invoice digitization

🧹 Shelf Doctor: AI shelf-analysis from video walkthrough

⏰ Automated expiry alerts

📊 Daily sales analytics & insights

🔗 Real-time seller ↔ supplier connectivity

✨ Key Features (Expanded)
🎙️ Voice-First Store Management
Add, update, or query stock using voice

Hindi, English, and Hinglish supported

Hands-free operation ideal for busy shop floors

📸 Visual AI Tools
Snap Item → Digitize product details using the phone camera

Scan Bill → AI extracts item details from purchase invoices

Shelf Doctor → AI analyses store shelves via video to detect:

Empty or unutilized spaces

Misplaced items

Category mismatch

Stock gaps
(Using a custom AI vision + generation model)

_____
⏰ Automated Expiry Alerts
Notifies shopkeepers before items expire

Helps minimize product wastage

📊 Sales Statistics & Insights
Daily sales analysis

Category-wise performance

Profit/loss trends

Smart recommendations

🔗 Supplier Connectivity
Real-time communication between sellers & suppliers

Suppliers can view:

Stock requirements

Orders

Profit/loss trends

Enables faster replenishment & decision-making

_____
🧰 Tech Stack 
Sound Sync_1 (Nitish Yadav)

Frontend
React

TypeScript

Vite

Tailwind CSS

Backend & Database
Firebase Authentication

Firebase Firestore (Real-time DB)

Firebase Storage (Media uploads)

AI & ML Components
Custom AI vision models (item & shelf understanding)

AI invoice understanding

Function-calling LLM for logic automation

Real-time TTS for assistant responses

low-latency audio streaming via google-native-audio-preview

Communication Layer
Real-time seller ↔ supplier messaging

____
🔄 Workflow 
Input Options
🎤 Voice command

📸 Camera scan

🎥 Shelf video walkthrough

Process
AI understands user intent

Validates items/categories

Executes inventory logic

Updates Firebase in real time

Output
UI updates instantly

AI provides voice + visual confirmation

___
🚀 Getting Started
Install Dependencies
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
Preview Production Build
bash
Copy code
npm run preview
______

🎯 Impact
Reduces inventory tracking errors

Prevents losses from expired or missing stock

Saves time using voice-based, hands-free management

Simplifies store digitization for non-tech users

Improves supplier–seller workflows

Bridges the gap between local retail & modern AI capabilities

___
📄 License
Released under the MIT License.
