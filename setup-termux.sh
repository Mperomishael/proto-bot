#!/data/data/com.termux/files/usr/bin/bash
echo "🔧 Setting up Empire Bot-Wan V2 on Termux..."
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts git ffmpeg libwebp python build-essential
echo "📦 Installing Node dependencies..."
npm install
echo ""
echo "✅ Setup complete!"
echo "👉 Next: copy .env.example to .env and fill in your OWNER_NUMBER"
echo "   Then run: npm start"
