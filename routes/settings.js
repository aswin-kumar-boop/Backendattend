const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Assuming your globalSettings.js exports an object
const settingsPath = path.resolve(__dirname, '../config/globalSettings.js');

// Middleware to read settings
const readSettings = (req, res, next) => {
  delete require.cache[require.resolve(settingsPath)]; // Ensure the module is reloaded every time
  const settings = require(settingsPath);
  req.app.locals.settings = settings; // Store settings in app locals
  next();
};

// GET endpoint for retrieving settings
router.get('/api/settings', readSettings, (req, res) => {
  res.json(req.app.locals.settings);
});

// POST endpoint for updating settings
router.post('/api/settings', (req, res) => {
  const newSettings = req.body;
  // Validate newSettings here if necessary
  const settingsContent = `module.exports = ${JSON.stringify(newSettings, null, 2)};`;

  fs.writeFile(settingsPath, settingsContent, (err) => {
    if (err) {
      console.error('Failed to update settings:', err);
      return res.status(500).json({ message: 'Failed to update settings' });
    }
    res.json({ message: 'Settings updated successfully' });
  });
});

module.exports = router;
