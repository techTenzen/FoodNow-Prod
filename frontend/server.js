const express = require('express');
const path = require('path');
const app = express();

// The Angular build output directory is now 'dist/frontend/browser'
// relative to this server.js file's location.
const buildPath = path.join(__dirname, 'dist/frontend/browser');
app.use(express.static(buildPath));

// For all other routes, send back the main index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

// Start the server
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
