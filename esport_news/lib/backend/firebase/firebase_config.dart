import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

Future initFirebase() async {
  if (kIsWeb) {
    await Firebase.initializeApp(
        options: FirebaseOptions(
            apiKey: "AIzaSyDsY8sJVKJ_ftlfi23Pgr0sMpZXTu4KASg",
            authDomain: "esportnews-96de4.firebaseapp.com",
            projectId: "esportnews-96de4",
            storageBucket: "esportnews-96de4.firebasestorage.app",
            messagingSenderId: "371713554228",
            appId: "1:371713554228:web:cabc52b0f37be2d2679761",
            measurementId: "G-GME114F2B5"));
  } else {
    await Firebase.initializeApp();
  }
}
