const functions = require("firebase-functions");
require("firebase-functions/logger/compat"); // permet d'utiliser console.log etc.
const fetch = require("node-fetch");

const API_KEY = "Bearer rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk";
const PROXY_URL =
  "https://europe-west1-esportnews-96de4.cloudfunctions.net/imageProxy";

const proxyify = (url) =>
  url ? `${PROXY_URL}?url=${encodeURIComponent(url)}` : url;

const rewriteTournamentImages = (t) => {
  console.log("rewriteTournamentImages: début transformation tournoi");
  // réécrire league.image_url
  if (t.league && t.league.image_url) {
    t.league = { ...t.league, image_url: proxyify(t.league.image_url) };
  }

  // réécrire teams[].image_url
  if (Array.isArray(t.teams)) {
    t.teams = t.teams.map((team) => {
      const updatedUrl = proxyify(team.image_url);
      return { ...team, image_url: updatedUrl };
    });
  }

  // réécrire expected_roster[].players/.team image_url
  if (Array.isArray(t.expected_roster)) {
    t.expected_roster = t.expected_roster.map((slot, index) => {
      console.log(`Slot ${index} dans expected_roster`);
      const players = Array.isArray(slot.players)
        ? slot.players.map((p) => {
            console.log(`-- player ${p.name} avant URL:`, p.image_url);
            return { ...p, image_url: proxyify(p.image_url) };
          })
        : slot.players;

      const rosterTeam = slot.team
        ? { ...slot.team, image_url: proxyify(slot.team.image_url) }
        : slot.team;

      return { ...slot, players, team: rosterTeam };
    });
  }

  return t;
};

exports.getRunningSingleEvent = functions
  .region("europe-west1")
  .https.onCall(async (data, _context) => {
    console.log("getUpCommingEvent: appel début");
    try {
      // ✅ récupère la variable "game" dans les paramètres
      const game = (data?.game || "").toString().trim().toLowerCase();

      // ✅ construit l’URL : avec ou sans le préfixe game
      const base = game
        ? `https://api.pandascore.co/${game}/tournaments/running`
        : `https://api.pandascore.co/tournaments/running`;

      const url = new URL(base);
      url.searchParams.set("sort", "begin_at");
      url.searchParams.set("page[size]", "100");

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: API_KEY,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new functions.https.HttpsError(
          "internal",
          `PandaScore ${res.status}: ${text}`,
        );
      }

      const js = await res.json();

      const updated = Array.isArray(js)
        ? js.map(rewriteTournamentImages)
        : rewriteTournamentImages(js);

      return updated[0];
    } catch (err) {
      throw new functions.https.HttpsError(
        "internal",
        err.message || "Erreur interne",
      );
    }
  });
