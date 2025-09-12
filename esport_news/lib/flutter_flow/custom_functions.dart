import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:timeago/timeago.dart' as timeago;
import 'lat_lng.dart';
import 'place.dart';
import 'uploaded_file.dart';
import '/backend/backend.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '/backend/schema/structs/index.dart';
import '/backend/schema/enums/enums.dart';
import '/auth/custom_auth/auth_util.dart';

/// encore url
String? encodeUri(String? url) {
  // créer une function qui prend en paramètre une url, qui applique un encodage uri String uriEncode(String inputUrl) {   return Uri.encodeFull(inputUrl); } et qui retourn l'url encodé
  if (url == null) return null; // Check for null input
  return Uri.encodeFull(url); // Encode the URL
}

String? getProxiedImageUrl(String? imageUrl) {
  final encoded = Uri.encodeFull(imageUrl!);
  return 'https://europe-west1-esportnews-96de4.cloudfunctions.net/imagePandascore?url=$encoded';
}
