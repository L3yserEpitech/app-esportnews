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
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#060B13"
      },
      package: "com.esportnews-app.mobile",
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-font"
    ],
    extra: {
      router: {},
      eas: {
        projectId: "96bacb7b-e2b7-4bfa-b8ad-940dc3e54815"
      },
      // Environment variables - accessible via expo-constants
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000",
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || "development"
    }
  }
};
