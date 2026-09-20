const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Centralized Data Store Mock (In production, load via SQLite or memory cache)
let localAlarms = [];

// Endpoint providing a single, clean timeline payload for the tablet
app.get('/api/dashboard', async (req, res) => {
  try {
    const timeline = [];
    
    // 1. Fetch Google Calendar if configured
    if (process.env.GOOGLE_CALENDAR_API_KEY) {
      // Logic to fetch & push into timeline
    }

    // 2. Fetch Canvas LMS if configured
    if (process.env.CANVAS_ACCESS_TOKEN) {
      try {
        const canvasRes = await axios.get(`${process.env.CANVAS_BASE_URL}/api/v1/todo`, {
          headers: { Authorization: `Bearer ${process.env.CANVAS_ACCESS_TOKEN}` }
        });
        canvasRes.data.forEach(item => {
          if (item.assignment) {
            timeline.push({
              id: `canvas-${item.assignment.id}`,
              source: 'canvas',
              title: item.assignment.name,
              time: item.assignment.due_at,
              type: 'assignment'
            });
          }
        });
      } catch (err) { console.error("Canvas sync failed:", err.message); }
    }

    // 3. Fetch Weather Data
    let weather = { temp: '--', condition: 'Unknown' };
    if (process.env.WEATHER_API_KEY) {
      try {
        const weatherRes = await axios.get(`https://weatherapi.com{process.env.WEATHER_API_KEY}&q=Springfield`);
        weather = {
          temp: `${Math.round(weatherRes.data.current.temp_f)}°F`,
          condition: weatherRes.data.current.condition.text
        };
      } catch (err) { console.error("Weather sync failed:", err.message); }
    }

    // Sort timeline chronologically by upcoming items
    timeline.sort((a, b) => new Date(a.time) - new Date(b.time));

    res.json({
      weather,
      alarms: localAlarms,
      events: timeline.slice(0, 5) // Send only the top 5 next items to protect tablet RAM
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to aggregate dashboard data' });
  }
});

// Trigger Discord Notification Webhook
app.post('/api/notify-discord', async (req, res) => {
  const { message } = req.body;
  if (!process.env.DISCORD_WEBHOOK_URL) return res.status(400).json({ error: 'Webhook unconfigured' });
  
  try {
    await axios.post(process.env.DISCORD_WEBHOOK_URL, { content: message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Discord transmission failed' });
  }
});

app.listen(PORT, () => console.log(`Backend spinning up on port ${PORT}`));
