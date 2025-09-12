import 'dart:convert';

import 'package:flutter/foundation.dart';

import '/flutter_flow/flutter_flow_util.dart';
import 'api_manager.dart';

export 'api_manager.dart' show ApiCallResponse;

const _kPrivateApiFunctionName = 'ffPrivateApiCall';

/// Start EsportDevs Group Code

class EsportDevsGroup {
  static String getBaseUrl({
    String? authToken = '7KwP-8CB10mnytro5OinZA',
  }) =>
      'https://esports.sportdevs.com';
  static Map<String, String> headers = {
    'Accept': 'application/json',
    'Authorization': 'Bearer [authToken]',
  };
  static LiveMatchCall liveMatchCall = LiveMatchCall();
  static TeamInfoCall teamInfoCall = TeamInfoCall();
}

class LiveMatchCall {
  Future<ApiCallResponse> call({
    String? authToken = '7KwP-8CB10mnytro5OinZA',
  }) async {
    final baseUrl = EsportDevsGroup.getBaseUrl(
      authToken: authToken,
    );

    return ApiManager.instance.makeApiCall(
      callName: 'Live match',
      apiUrl: '${baseUrl}/matches?status_type=eq.live',
      callType: ApiCallType.GET,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ${authToken}',
      },
      params: {},
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }

  List<int>? id(dynamic response) => (getJsonField(
        response,
        r'''$[:].id''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  List<String>? name(dynamic response) => (getJsonField(
        response,
        r'''$[:].name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<int>? homeTeamId(dynamic response) => (getJsonField(
        response,
        r'''$[:].home_team_id''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  List<String>? tournamentName(dynamic response) => (getJsonField(
        response,
        r'''$[:].tournament_name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? seasonName(dynamic response) => (getJsonField(
        response,
        r'''$[:].season_name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? homeTeamName(dynamic response) => (getJsonField(
        response,
        r'''$[:].home_team_name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? homeTeamHashImage(dynamic response) => (getJsonField(
        response,
        r'''$[:].home_team_hash_image''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<int>? awayTeamId(dynamic response) => (getJsonField(
        response,
        r'''$[:].away_team_id''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  List<String>? awayTeamName(dynamic response) => (getJsonField(
        response,
        r'''$[:].away_team_name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? awayTeamHashImage(dynamic response) => (getJsonField(
        response,
        r'''$[:].away_team_hash_image''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List? homeTeamScore(dynamic response) => getJsonField(
        response,
        r'''$[:].home_team_score''',
        true,
      ) as List?;
  List<int>? homeTeamScoreCurrent(dynamic response) => (getJsonField(
        response,
        r'''$[:].home_team_score.current''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  List<int>? homeTeamScoreDisplay(dynamic response) => (getJsonField(
        response,
        r'''$[:].home_team_score.display''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  List? awayTeamScore(dynamic response) => getJsonField(
        response,
        r'''$[:].away_team_score''',
        true,
      ) as List?;
  List<int>? awayTeamScoreCurrent(dynamic response) => (getJsonField(
        response,
        r'''$[:].away_team_score.current''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  List<int>? awayTeamScoreDisplay(dynamic response) => (getJsonField(
        response,
        r'''$[:].away_team_score.display''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  List<String>? leagueName(dynamic response) => (getJsonField(
        response,
        r'''$[:].league_name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? leagueHashImage(dynamic response) => (getJsonField(
        response,
        r'''$[:].league_hash_image''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<int>? leagueId(dynamic response) => (getJsonField(
        response,
        r'''$[:].league_id''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  List<String>? className(dynamic response) => (getJsonField(
        response,
        r'''$[:].class_name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
}

class TeamInfoCall {
  Future<ApiCallResponse> call({
    String? teamId = '',
    String? authToken = '7KwP-8CB10mnytro5OinZA',
  }) async {
    final baseUrl = EsportDevsGroup.getBaseUrl(
      authToken: authToken,
    );

    return ApiManager.instance.makeApiCall(
      callName: 'Team info',
      apiUrl: '${baseUrl}/teams?id=eq.${teamId}',
      callType: ApiCallType.GET,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ${authToken}',
      },
      params: {},
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

/// End EsportDevs Group Code

/// Start Article Group Code

class ArticleGroup {
  static String getBaseUrl() =>
      'https://x8ki-letl-twmt.n7.xano.io/api:fechLyTn';
  static Map<String, String> headers = {};
  static AllArticleCall allArticleCall = AllArticleCall();
  static MainArticleCall mainArticleCall = MainArticleCall();
  static DeleteArticleCall deleteArticleCall = DeleteArticleCall();
  static AddArticleCall addArticleCall = AddArticleCall();
}

class AllArticleCall {
  Future<ApiCallResponse> call() async {
    final baseUrl = ArticleGroup.getBaseUrl();

    return ApiManager.instance.makeApiCall(
      callName: 'All Article',
      apiUrl: '${baseUrl}/article',
      callType: ApiCallType.GET,
      headers: {},
      params: {},
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

class MainArticleCall {
  Future<ApiCallResponse> call() async {
    final baseUrl = ArticleGroup.getBaseUrl();

    return ApiManager.instance.makeApiCall(
      callName: 'Main article',
      apiUrl: '${baseUrl}/article_last',
      callType: ApiCallType.GET,
      headers: {},
      params: {},
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

class DeleteArticleCall {
  Future<ApiCallResponse> call({
    int? articleId,
  }) async {
    final baseUrl = ArticleGroup.getBaseUrl();

    return ApiManager.instance.makeApiCall(
      callName: 'Delete article',
      apiUrl: '${baseUrl}/article/${articleId}',
      callType: ApiCallType.DELETE,
      headers: {},
      params: {},
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

class AddArticleCall {
  Future<ApiCallResponse> call({
    String? name = '',
    String? articleDescription = '',
    FFUploadedFile? image,
  }) async {
    final baseUrl = ArticleGroup.getBaseUrl();

    return ApiManager.instance.makeApiCall(
      callName: 'Add article',
      apiUrl: '${baseUrl}/article',
      callType: ApiCallType.POST,
      headers: {},
      params: {
        'name': name,
        'article_description': articleDescription,
        'photo': image,
      },
      bodyType: BodyType.MULTIPART,
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

/// End Article Group Code

/// Start pandascore Group Code

class PandascoreGroup {
  static String getBaseUrl({
    String? authToken = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk',
  }) =>
      'https://api.pandascore.co';
  static Map<String, String> headers = {
    'Accept': 'application/json',
    'Authorization': 'Bearer [authToken]',
  };
  static FetchAllTeamsCall fetchAllTeamsCall = FetchAllTeamsCall();
  static FetchTeamInfoCall fetchTeamInfoCall = FetchTeamInfoCall();
  static SearchTeamCall searchTeamCall = SearchTeamCall();
  static SearchSpecificTeamCall searchSpecificTeamCall =
      SearchSpecificTeamCall();
}

class FetchAllTeamsCall {
  Future<ApiCallResponse> call({
    int? pageNumber = 1,
    String? authToken = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk',
  }) async {
    final baseUrl = PandascoreGroup.getBaseUrl(
      authToken: authToken,
    );

    return ApiManager.instance.makeApiCall(
      callName: 'Fetch all teams',
      apiUrl: '${baseUrl}/teams',
      callType: ApiCallType.GET,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ${authToken}',
      },
      params: {
        'page[size]': 100,
        'page[number]': pageNumber,
      },
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }

  List<String>? teamName(dynamic response) => (getJsonField(
        response,
        r'''$[:].name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<int>? teamId(dynamic response) => (getJsonField(
        response,
        r'''$[:].id''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
}

class FetchTeamInfoCall {
  Future<ApiCallResponse> call({
    int? teamId,
    String? authToken = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk',
  }) async {
    final baseUrl = PandascoreGroup.getBaseUrl(
      authToken: authToken,
    );

    return ApiManager.instance.makeApiCall(
      callName: 'Fetch team info',
      apiUrl: '${baseUrl}/teams/${teamId}',
      callType: ApiCallType.GET,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ${authToken}',
      },
      params: {},
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

class SearchTeamCall {
  Future<ApiCallResponse> call({
    String? nameSearched = '',
    String? authToken = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk',
  }) async {
    final baseUrl = PandascoreGroup.getBaseUrl(
      authToken: authToken,
    );

    return ApiManager.instance.makeApiCall(
      callName: 'Search team',
      apiUrl: '${baseUrl}/teams',
      callType: ApiCallType.GET,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ${authToken}',
      },
      params: {
        'search[name]': nameSearched,
      },
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }

  List<String>? name(dynamic response) => (getJsonField(
        response,
        r'''$[:].name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? nameVideoGame(dynamic response) => (getJsonField(
        response,
        r'''$[:].current_videogame.name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? location(dynamic response) => (getJsonField(
        response,
        r'''$[:].location''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? acronyme(dynamic response) => (getJsonField(
        response,
        r'''$[:].acronym''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? slugVideoGame(dynamic response) => (getJsonField(
        response,
        r'''$[:].current_videogame.slug''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<int>? idVideoGame(dynamic response) => (getJsonField(
        response,
        r'''$[:].current_videogame.id''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<int>(x))
          .withoutNulls
          .toList();
  List<String>? image(dynamic response) => (getJsonField(
        response,
        r'''$[:].image_url''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
  List<String>? creationDate(dynamic response) => (getJsonField(
        response,
        r'''$[:].modified_at''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
}

class SearchSpecificTeamCall {
  Future<ApiCallResponse> call({
    String? nameSearched = '',
    String? game = '',
    String? authToken = 'rwFHKSceUVggRdOXVYu-fquzUGhb-bH14D785_BuLmD_kmV_ndk',
  }) async {
    final baseUrl = PandascoreGroup.getBaseUrl(
      authToken: authToken,
    );

    return ApiManager.instance.makeApiCall(
      callName: 'Search specific team',
      apiUrl: '${baseUrl}/${game}/teams',
      callType: ApiCallType.GET,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ${authToken}',
      },
      params: {
        'search[name]': nameSearched,
      },
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }

  List<String>? videogame(dynamic response) => (getJsonField(
        response,
        r'''$[:].current_videogame.name''',
        true,
      ) as List?)
          ?.withoutNulls
          .map((x) => castToType<String>(x))
          .withoutNulls
          .toList();
}

/// End pandascore Group Code

class SignupCall {
  static Future<ApiCallResponse> call({
    String? name = '',
    String? email = '',
    String? password = '',
  }) async {
    final ffApiRequestBody = '''
{
  "name": "${escapeStringForJson(name)}",
  "email": "${escapeStringForJson(email)}",
  "password": "${escapeStringForJson(password)}"
}''';
    return ApiManager.instance.makeApiCall(
      callName: 'Signup',
      apiUrl: 'https://x8ki-letl-twmt.n7.xano.io/api:Pj8XX1w0/auth/signup',
      callType: ApiCallType.POST,
      headers: {},
      params: {},
      body: ffApiRequestBody,
      bodyType: BodyType.JSON,
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }

  static String? authToken(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.authToken''',
      ));
}

class LoginCall {
  static Future<ApiCallResponse> call({
    String? email = '',
    String? password = '',
  }) async {
    final ffApiRequestBody = '''
{
  "email": "${escapeStringForJson(email)}",
  "password": "${escapeStringForJson(password)}"
}''';
    return ApiManager.instance.makeApiCall(
      callName: 'Login',
      apiUrl: 'https://x8ki-letl-twmt.n7.xano.io/api:Pj8XX1w0/auth/login',
      callType: ApiCallType.POST,
      headers: {},
      params: {},
      body: ffApiRequestBody,
      bodyType: BodyType.JSON,
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }

  static String? authToken(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.authToken''',
      ));
  static String? code(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.code''',
      ));
  static String? message(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.message''',
      ));
}

class AuthToUserCall {
  static Future<ApiCallResponse> call({
    String? authToken = '',
  }) async {
    return ApiManager.instance.makeApiCall(
      callName: 'Auth to User',
      apiUrl: 'https://x8ki-letl-twmt.n7.xano.io/api:Pj8XX1w0/auth/me',
      callType: ApiCallType.GET,
      headers: {
        'Authorization': 'Bearer ${authToken}',
      },
      params: {},
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }

  static String? name(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.name''',
      ));
  static String? email(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.email''',
      ));
  static int? id(dynamic response) => castToType<int>(getJsonField(
        response,
        r'''$.id''',
      ));
  static String? photoUrl(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.photo.url''',
      ));
}

class GoogleInitCall {
  static Future<ApiCallResponse> call() async {
    return ApiManager.instance.makeApiCall(
      callName: 'google init',
      apiUrl:
          'https://x8ki-letl-twmt.n7.xano.io/api:nRP2fUAB/oauth/google/init',
      callType: ApiCallType.GET,
      headers: {},
      params: {
        'redirect_uri': "https://esport-news-56qfgy.flutterflow.app/profil",
      },
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }

  static String? authUrl(dynamic response) => castToType<String>(getJsonField(
        response,
        r'''$.authUrl''',
      ));
}

class GoogleContinueCall {
  static Future<ApiCallResponse> call({
    String? code = '',
  }) async {
    return ApiManager.instance.makeApiCall(
      callName: 'google continue',
      apiUrl:
          'https://x8ki-letl-twmt.n7.xano.io/api:nRP2fUAB/oauth/google/continue',
      callType: ApiCallType.GET,
      headers: {},
      params: {
        'code': code,
        'redirect_uri': "https://esport-news-56qfgy.flutterflow.app/profil",
      },
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }

  static dynamic authToken(dynamic response) => getJsonField(
        response,
        r'''$.token''',
      );
  static dynamic name(dynamic response) => getJsonField(
        response,
        r'''$.name''',
      );
  static dynamic email(dynamic response) => getJsonField(
        response,
        r'''$.email''',
      );
}

class UpdataUserProfileMetadataCall {
  static Future<ApiCallResponse> call({
    String? authToken = '',
    String? name = '',
    String? email = '',
    int? userId,
  }) async {
    final ffApiRequestBody = '''
{
  "name": "${escapeStringForJson(name)}",
  "email": "${escapeStringForJson(email)}"
}''';
    return ApiManager.instance.makeApiCall(
      callName: 'Updata user profile metadata',
      apiUrl: 'https://x8ki-letl-twmt.n7.xano.io/api:CUVl1OW9/user/${userId}',
      callType: ApiCallType.PUT,
      headers: {
        'Authorization': 'Bearer ${authToken}',
      },
      params: {},
      body: ffApiRequestBody,
      bodyType: BodyType.JSON,
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

class UploadProfilePictureCall {
  static Future<ApiCallResponse> call({
    FFUploadedFile? file,
    String? authToken = '',
  }) async {
    return ApiManager.instance.makeApiCall(
      callName: 'Upload profile picture',
      apiUrl: 'https://x8ki-letl-twmt.n7.xano.io/api:CUVl1OW9/UploadImage',
      callType: ApiCallType.POST,
      headers: {
        'Authorization': 'Bearer ${authToken}',
      },
      params: {
        'file': file,
      },
      bodyType: BodyType.MULTIPART,
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

class DeleteFavTeamCall {
  static Future<ApiCallResponse> call({
    int? userId,
  }) async {
    return ApiManager.instance.makeApiCall(
      callName: 'delete fav team',
      apiUrl:
          'https://x8ki-letl-twmt.n7.xano.io/api:CUVl1OW9/user/fav/${userId}',
      callType: ApiCallType.DELETE,
      headers: {},
      params: {},
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

class ModifyFavTeamCall {
  static Future<ApiCallResponse> call({
    int? userId,
    dynamic favoriteTeamJson,
  }) async {
    final favoriteTeam = _serializeJson(favoriteTeamJson);

    return ApiManager.instance.makeApiCall(
      callName: 'modify fav team',
      apiUrl:
          'https://x8ki-letl-twmt.n7.xano.io/api:CUVl1OW9/user/fav/${userId}',
      callType: ApiCallType.PUT,
      headers: {},
      params: {
        'favorite_team': favoriteTeam,
      },
      bodyType: BodyType.MULTIPART,
      returnBody: true,
      encodeBodyUtf8: false,
      decodeUtf8: false,
      cache: false,
      isStreamingApi: false,
      alwaysAllowBody: false,
    );
  }
}

class ApiPagingParams {
  int nextPageNumber = 0;
  int numItems = 0;
  dynamic lastResponse;

  ApiPagingParams({
    required this.nextPageNumber,
    required this.numItems,
    required this.lastResponse,
  });

  @override
  String toString() =>
      'PagingParams(nextPageNumber: $nextPageNumber, numItems: $numItems, lastResponse: $lastResponse,)';
}

String _toEncodable(dynamic item) {
  if (item is DocumentReference) {
    return item.path;
  }
  return item;
}

String _serializeList(List? list) {
  list ??= <String>[];
  try {
    return json.encode(list, toEncodable: _toEncodable);
  } catch (_) {
    if (kDebugMode) {
      print("List serialization failed. Returning empty list.");
    }
    return '[]';
  }
}

String _serializeJson(dynamic jsonVar, [bool isList = false]) {
  jsonVar ??= (isList ? [] : {});
  try {
    return json.encode(jsonVar, toEncodable: _toEncodable);
  } catch (_) {
    if (kDebugMode) {
      print("Json serialization failed. Returning empty json.");
    }
    return isList ? '[]' : '{}';
  }
}

String? escapeStringForJson(String? input) {
  if (input == null) {
    return null;
  }
  return input
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"')
      .replaceAll('\n', '\\n')
      .replaceAll('\t', '\\t');
}
