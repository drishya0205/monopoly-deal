# 🎴 Monopoly Deal Online

A fully playable, online multiplayer clone of the popular Monopoly Deal card game. Built with a server-authoritative architecture to ensure fair play, and featuring a premium, dark-themed glassmorphism UI.

## ✨ Features

* **Real-time Multiplayer:** Play online with up to 4 friends across different devices using Socket.io.
* **Bot AI:** Don't have 4 players? Fill the empty seats with AI bots that know how to play properties, charge rent, and bank money.
* **Full Card Database:** All 110 original Monopoly Deal cards are meticulously implemented with their respective rules and actions.
* **Server-Authoritative Engine:** All game logic and validation happens on the backend. Opponents' hands are completely hidden and secure.
* **Premium UI:** A sleek, responsive, modern dark mode interface with dynamically generated DOM cards, hover effects, and a confetti victory screen.

## 🛠 Tech Stack

* **Frontend:** Vanilla HTML/CSS/JavaScript, Vite
* **Backend:** Node.js, Express
* **Networking:** Socket.io (Real-time bidirectional event-based communication)

## 🚀 How to Run Locally

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/drishya0205/monopoly-deal.git
   cd monopoly-deal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development servers (runs both backend and frontend):
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173`).

## 🎮 How to Play

1. **Host a Game:** Enter your name and click "Create Game".
2. **Invite Friends:** Share the 6-character room code with your friends. They can enter it on the home screen to join your lobby.
3. **Add Bots:** The host can click the "🤖 Add Bot" button to fill any empty seats.
4. **Start:** Once you have 2 to 4 players, click "Start Game".
5. **Taking your turn:** 
   * Click the **Draw Pile** in the center to draw your 2 cards.
   * Click any card in your hand to reveal action buttons (Play Property, Bank It, Play Action).
   * You can play up to 3 cards per turn.
   * Click **End Turn** when you are finished.
6. **Winning:** The first player to complete 3 full property sets wins!

## 🤝 Roadmap
- Add drag-and-drop mechanics for playing cards.
- Implement nicer modal overlays for targeting players/properties (currently uses browser prompts).
- Add game sound effects.
- Add an in-game chat system.

## 📝 License
This is a fan-made project for educational purposes. Monopoly Deal and its original assets/concepts are the property of Hasbro.
