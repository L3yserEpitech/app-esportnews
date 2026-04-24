// Load centralized .env from project root
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  expo: {
    name: "Esport News",
    slug: "esportnews",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: "esportnews",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#060B13"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.esportnews-app.mobile",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        GADApplicationIdentifier: process.env.ADMOB_IOS_APP_ID || "ca-app-pub-5118678813787741~6893939034",
        SKAdNetworkItems: [
          { SKAdNetworkIdentifier: "cstr6suwn9.skadnetwork" },
          { SKAdNetworkIdentifier: "4fzdc2evr5.skadnetwork" },
          { SKAdNetworkIdentifier: "4pfyvq9l8r.skadnetwork" },
          { SKAdNetworkIdentifier: "2fnua5tdw4.skadnetwork" },
          { SKAdNetworkIdentifier: "ydx93a7ass.skadnetwork" },
          { SKAdNetworkIdentifier: "5a6flpkh64.skadnetwork" },
          { SKAdNetworkIdentifier: "p78aez3r4s.skadnetwork" },
          { SKAdNetworkIdentifier: "v72qych5uu.skadnetwork" },
          { SKAdNetworkIdentifier: "ludvb6z3bs.skadnetwork" },
          { SKAdNetworkIdentifier: "cp8zw746q7.skadnetwork" },
          { SKAdNetworkIdentifier: "3sh42y64q3.skadnetwork" },
          { SKAdNetworkIdentifier: "c6k4g5qg8m.skadnetwork" },
          { SKAdNetworkIdentifier: "s39g8k73mm.skadnetwork" },
          { SKAdNetworkIdentifier: "3qy4746246.skadnetwork" },
          { SKAdNetworkIdentifier: "f38h382jlk.skadnetwork" },
          { SKAdNetworkIdentifier: "hs6bdukanm.skadnetwork" },
          { SKAdNetworkIdentifier: "v4nxqhlyqp.skadnetwork" },
          { SKAdNetworkIdentifier: "wzmmz9fp6w.skadnetwork" },
          { SKAdNetworkIdentifier: "yclnxrl5pm.skadnetwork" },
          { SKAdNetworkIdentifier: "t38b2kh725.skadnetwork" },
          { SKAdNetworkIdentifier: "7ug5zh24hu.skadnetwork" },
          { SKAdNetworkIdentifier: "gta9lk7p23.skadnetwork" },
          { SKAdNetworkIdentifier: "vutu7akeur.skadnetwork" },
          { SKAdNetworkIdentifier: "y5ghdn5j9k.skadnetwork" },
          { SKAdNetworkIdentifier: "n6fk4nfna4.skadnetwork" },
          { SKAdNetworkIdentifier: "v9wttpbfk9.skadnetwork" },
          { SKAdNetworkIdentifier: "n38lu8286q.skadnetwork" },
          { SKAdNetworkIdentifier: "47vhws6wlr.skadnetwork" },
          { SKAdNetworkIdentifier: "kbd757ywx3.skadnetwork" },
          { SKAdNetworkIdentifier: "9t245vhmpl.skadnetwork" },
          { SKAdNetworkIdentifier: "eh6m2bh4zr.skadnetwork" },
          { SKAdNetworkIdentifier: "a2p9lx4jpn.skadnetwork" },
          { SKAdNetworkIdentifier: "22mmun2rn5.skadnetwork" },
          { SKAdNetworkIdentifier: "4468km3ulz.skadnetwork" },
          { SKAdNetworkIdentifier: "2u9pt9hc89.skadnetwork" },
          { SKAdNetworkIdentifier: "8s468mfl3y.skadnetwork" },
          { SKAdNetworkIdentifier: "klf5c3l5u5.skadnetwork" },
          { SKAdNetworkIdentifier: "ppxm28t8ap.skadnetwork" },
          { SKAdNetworkIdentifier: "ecpz2srf59.skadnetwork" },
          { SKAdNetworkIdentifier: "uw77j35x4d.skadnetwork" },
          { SKAdNetworkIdentifier: "pwa73g5rt2.skadnetwork" },
          { SKAdNetworkIdentifier: "mlmmfzh3r3.skadnetwork" },
          { SKAdNetworkIdentifier: "578prtvx9j.skadnetwork" },
          { SKAdNetworkIdentifier: "4dzt52r2t5.skadnetwork" },
          { SKAdNetworkIdentifier: "e5fvkxwrpn.skadnetwork" },
          { SKAdNetworkIdentifier: "8c4e2ghe7u.skadnetwork" },
          { SKAdNetworkIdentifier: "zq492l623r.skadnetwork" },
          { SKAdNetworkIdentifier: "3rd42ekr43.skadnetwork" },
          { SKAdNetworkIdentifier: "3qcr597p9d.skadnetwork" }
        ],
        NSCameraUsageDescription: "Esport News a besoin d'accéder à votre appareil photo pour vous permettre de prendre une photo de profil. Cette photo sera utilisée comme avatar sur votre compte.",
        NSPhotoLibraryUsageDescription: "Esport News a besoin d'accéder à votre galerie photos pour vous permettre de choisir une photo de profil. Cette photo sera utilisée comme avatar sur votre compte."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#060B13"
      },
      package: "com.esportnewsapp.mobile",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-tracking-transparency",
        {
          userTrackingPermission: "Cette application utilise le suivi publicitaire pour vous montrer des publicités personnalisées."
        }
      ],
      [
        "react-native-google-mobile-ads",
        {
          androidAppId: process.env.ADMOB_ANDROID_APP_ID || "ca-app-pub-5118678813787741~6893939034",
          iosAppId: process.env.ADMOB_IOS_APP_ID || "ca-app-pub-5118678813787741~6893939034"
        }
      ]
    ],
    extra: {
      router: {},
      eas: {
        projectId: "96bacb7b-e2b7-4bfa-b8ad-940dc3e54815"
      },
      // Environment variables - accessible via expo-constants
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || "development",
      // AdMob Ad Unit IDs
      admobInterstitialId: process.env.ADMOB_INTERSTITIAL_ID || "ca-app-pub-5118678813787741/4414379260"
    }
  }
};
