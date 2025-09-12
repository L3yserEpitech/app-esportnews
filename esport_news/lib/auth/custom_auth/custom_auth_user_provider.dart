import 'package:rxdart/rxdart.dart';

import 'custom_auth_manager.dart';

class EsportNewsAuthUser {
  EsportNewsAuthUser({required this.loggedIn, this.uid});

  bool loggedIn;
  String? uid;
}

/// Generates a stream of the authenticated user.
BehaviorSubject<EsportNewsAuthUser> esportNewsAuthUserSubject =
    BehaviorSubject.seeded(EsportNewsAuthUser(loggedIn: false));
Stream<EsportNewsAuthUser> esportNewsAuthUserStream() =>
    esportNewsAuthUserSubject
        .asBroadcastStream()
        .map((user) => currentUser = user);
