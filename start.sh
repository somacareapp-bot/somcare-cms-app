#!/bin/bash

echo "🏥 Starting Clinical Management System..."

# Start backend in background
cd "/Users/adminnopassword/Documents/Clinical MS/cms/backend"
npm run start:dev &
BACKEND_PID=$!
echo "✅ Backend starting (PID: $BACKEND_PID)"

# Wait for backend to be ready
echo "⏳ Waiting for backend..."
sleep 5

# Start frontend in background
cd "/Users/adminnopassword/Documents/Clinical MS/cms/frontend"
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend starting (PID: $FRONTEND_PID)"

echo ""
echo "🚀 All services started!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop everything"

# When Ctrl+C is pressed, kill both
trap "echo '🛑 Stopping all services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait
