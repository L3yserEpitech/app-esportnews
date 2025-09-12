const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

// API key
const API_KEY = "Bearer rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk";
// Proxy base URL
const PROXY_URL =
  "https://europe-west1-esportnews-96de4.cloudfunctions.net/imageProxy";

exports.searchTeam = functions
  .region("europe-west1")
  .https.onCall(async (data, context) => {
    const team = data.team;
    const game = data.game;

    const baseUrl = "https://api.pandascore.co";
    const endpoint = game ? `/${game}/teams` : `/teams`;
    const fullUrl = `${baseUrl}${endpoint}?search[name]=${encodeURIComponent(team)}`;

    try {
      const response = await fetch(fullUrl, {
        headers: {
          Authorization: API_KEY,
          Accept: "application/json",
        },
      });

      const json = await response.json();

      // Modifier chaque image_url
      const updated = json.map((item) => {
        if (item.image_url) {
          const encodedUrl = encodeURIComponent(item.image_url);
          return {
            ...item,
            image_url: `${PROXY_URL}?url=${encodedUrl}`,
          };
        }
        return item;
      });

      return updated;
    } catch (error) {
      console.error(error);
      throw new functions.https.HttpsError("internal", "Failed to fetch team");
    }
  });
