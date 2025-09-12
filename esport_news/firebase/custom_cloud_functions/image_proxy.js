const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

exports.imageProxy = functions
  .region("europe-west1")
  .https.onRequest(async (req, res) => {
    const imageUrl = decodeURIComponent(req.query.url || "");

    if (!imageUrl || !imageUrl.startsWith("http")) {
      return res.status(400).send('Missing or invalid "url" parameter');
    }

    try {
      const response = await fetch(imageUrl);

      if (!response.ok) {
        console.error(`Error fetching image: ${response.status}`);
        return res.status(502).send("Failed to fetch image");
      }

      const buffer = await response.buffer();
      const contentType = response.headers.get("content-type") || "image/png";

      res.set("Access-Control-Allow-Origin", "*");
      res.set("Content-Type", contentType);
      res.send(buffer);
    } catch (err) {
      console.error("Error:", err);
      res.status(500).send("Internal Server Error");
    }
  });
