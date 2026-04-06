# 📈 TradeJournal Pro v3.1

TradeJournal Pro ek advanced trading journal dashboard hai jo traders ko unki performance track karne, analytics dekhne aur unki trading psychology ko behtar banane mein madad karta hai. Isme Voice Commands aur AI-style features bhi shamil hain.

## ✨ Key Features

- **Personalized Dashboard:** Aapka PnL, Win Rate aur Total Trades ka real-time overview.
- **Advanced Analytics:** Charts (PnL curve, Emotion analysis, Symbol performance) ke zariye trading patterns ko samjhein.
- **Voice System:** Voice commands ke zariye dashboard navigate karein ya trade add karein (e.g., "show dashboard", "win rate").
- **Screenshot Integration:** Apne trades ke screenshots directly upload ya paste karein.
- **Dark/Light Mode:** Seamless theme switching jo aapki preferences ke mutabiq save rehti hai.
- **Self-Documenting Errors:** Har trade ke sath mistakes aur emotions ko track karne ka makhsoos system.
- **Keyboard Shortcuts:** Fast navigation ke liye shortcut keys support.

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3 (Custom Properties), JavaScript (Vanilla ES6+)
- **Charts:** Chart.js library
- **Storage:** LocalStorage (Privacy focus: aapka data aapke browser mein hi rehta hai)
- **Deployment:** Vercel Optimized

## 🚀 Installation & Deployment

### Local Setup
1. Repository ko clone karein ya zip file extract karein.
2. `index.html` file ko kisi bhi modern web browser mein open karein.

### Vercel Deployment
Is project ko Vercel par deploy karne ke liye:
1. Root directory mein `vercel.json` file ka hona zaroori hai (shamil hai).
2. GitHub par push karein aur Vercel dashboard se connect karein.
3. **Note:** Agar files load nahi ho rahi hain, toh Vercel settings mein "Root Directory" ko `tradejournalpro` folder par set karein.

## 📁 File Structure

- `index.html`: Main application interface.
- `style.css`: Modern UI/UX design aur animations.
- `app.js`: Core logic, Auth, State management aur Voice system.
- `charts.js`: Data visualization aur trading tables logic.
- `vercel.json`: Deployment configuration.

## ⌨️ Shortcuts
- `Alt + D`: Open Dashboard
- `Alt + T`: View Trades
- `Alt + A`: Open Analytics

## 📝 License
Yeh project personal trading use ke liye banaya gaya hai.

---
*Created for Traders by Traders.*
