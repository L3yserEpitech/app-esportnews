import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:csv/csv.dart';
import 'package:synchronized/synchronized.dart';
import 'flutter_flow/flutter_flow_util.dart';

class FFAppState extends ChangeNotifier {
  static FFAppState _instance = FFAppState._internal();

  factory FFAppState() {
    return _instance;
  }

  FFAppState._internal();

  static void reset() {
    _instance = FFAppState._internal();
  }

  Future initializePersistedState() async {
    secureStorage = FlutterSecureStorage();
    await _safeInitAsync(() async {
      _admin = await secureStorage.getBool('ff_admin') ?? _admin;
    });
    await _safeInitAsync(() async {
      _userId = await secureStorage.getInt('ff_userId') ?? _userId;
    });
    await _safeInitAsync(() async {
      _csSelected = await secureStorage.getBool('ff_csSelected') ?? _csSelected;
    });
    await _safeInitAsync(() async {
      _lolSelected =
          await secureStorage.getBool('ff_lolSelected') ?? _lolSelected;
    });
    await _safeInitAsync(() async {
      _dotaSelected =
          await secureStorage.getBool('ff_dotaSelected') ?? _dotaSelected;
    });
    await _safeInitAsync(() async {
      _fifaSelected =
          await secureStorage.getBool('ff_fifaSelected') ?? _fifaSelected;
    });
    await _safeInitAsync(() async {
      _nbaSelected =
          await secureStorage.getBool('ff_nbaSelected') ?? _nbaSelected;
    });
    await _safeInitAsync(() async {
      _teamIsSelected =
          await secureStorage.getBool('ff_teamIsSelected') ?? _teamIsSelected;
    });
    await _safeInitAsync(() async {
      if (await secureStorage.read(key: 'ff_teamSelected') != null) {
        try {
          _teamSelected = jsonDecode(
              await secureStorage.getString('ff_teamSelected') ?? '');
        } catch (e) {
          print("Can't decode persisted json. Error: $e.");
        }
      }
    });
    await _safeInitAsync(() async {
      _searchByTeam =
          await secureStorage.getBool('ff_searchByTeam') ?? _searchByTeam;
    });
    await _safeInitAsync(() async {
      _gameSelected =
          await secureStorage.getString('ff_gameSelected') ?? _gameSelected;
    });
  }

  void update(VoidCallback callback) {
    callback();
    notifyListeners();
  }

  late FlutterSecureStorage secureStorage;

  String _authToken = '';
  String get authToken => _authToken;
  set authToken(String value) {
    _authToken = value;
  }

  bool _isValidUser = false;
  bool get isValidUser => _isValidUser;
  set isValidUser(bool value) {
    _isValidUser = value;
  }

  String _userEmail = '';
  String get userEmail => _userEmail;
  set userEmail(String value) {
    _userEmail = value;
  }

  String _userName = '';
  String get userName => _userName;
  set userName(String value) {
    _userName = value;
  }

  String _userPhoto = '';
  String get userPhoto => _userPhoto;
  set userPhoto(String value) {
    _userPhoto = value;
  }

  bool _admin = false;
  bool get admin => _admin;
  set admin(bool value) {
    _admin = value;
    secureStorage.setBool('ff_admin', value);
  }

  void deleteAdmin() {
    secureStorage.delete(key: 'ff_admin');
  }

  bool _userPremium = false;
  bool get userPremium => _userPremium;
  set userPremium(bool value) {
    _userPremium = value;
  }

  int _userId = 0;
  int get userId => _userId;
  set userId(int value) {
    _userId = value;
    secureStorage.setInt('ff_userId', value);
  }

  void deleteUserId() {
    secureStorage.delete(key: 'ff_userId');
  }

  bool _csSelected = false;
  bool get csSelected => _csSelected;
  set csSelected(bool value) {
    _csSelected = value;
    secureStorage.setBool('ff_csSelected', value);
  }

  void deleteCsSelected() {
    secureStorage.delete(key: 'ff_csSelected');
  }

  bool _lolSelected = false;
  bool get lolSelected => _lolSelected;
  set lolSelected(bool value) {
    _lolSelected = value;
    secureStorage.setBool('ff_lolSelected', value);
  }

  void deleteLolSelected() {
    secureStorage.delete(key: 'ff_lolSelected');
  }

  bool _dotaSelected = false;
  bool get dotaSelected => _dotaSelected;
  set dotaSelected(bool value) {
    _dotaSelected = value;
    secureStorage.setBool('ff_dotaSelected', value);
  }

  void deleteDotaSelected() {
    secureStorage.delete(key: 'ff_dotaSelected');
  }

  bool _fifaSelected = false;
  bool get fifaSelected => _fifaSelected;
  set fifaSelected(bool value) {
    _fifaSelected = value;
    secureStorage.setBool('ff_fifaSelected', value);
  }

  void deleteFifaSelected() {
    secureStorage.delete(key: 'ff_fifaSelected');
  }

  bool _nbaSelected = false;
  bool get nbaSelected => _nbaSelected;
  set nbaSelected(bool value) {
    _nbaSelected = value;
    secureStorage.setBool('ff_nbaSelected', value);
  }

  void deleteNbaSelected() {
    secureStorage.delete(key: 'ff_nbaSelected');
  }

  bool _isConnected = false;
  bool get isConnected => _isConnected;
  set isConnected(bool value) {
    _isConnected = value;
  }

  bool _photoUploaded = false;
  bool get photoUploaded => _photoUploaded;
  set photoUploaded(bool value) {
    _photoUploaded = value;
  }

  List<dynamic> _listArticle = [];
  List<dynamic> get listArticle => _listArticle;
  set listArticle(List<dynamic> value) {
    _listArticle = value;
  }

  void addToListArticle(dynamic value) {
    listArticle.add(value);
  }

  void removeFromListArticle(dynamic value) {
    listArticle.remove(value);
  }

  void removeAtIndexFromListArticle(int index) {
    listArticle.removeAt(index);
  }

  void updateListArticleAtIndex(
    int index,
    dynamic Function(dynamic) updateFn,
  ) {
    listArticle[index] = updateFn(_listArticle[index]);
  }

  void insertAtIndexInListArticle(int index, dynamic value) {
    listArticle.insert(index, value);
  }

  dynamic _mainArticle;
  dynamic get mainArticle => _mainArticle;
  set mainArticle(dynamic value) {
    _mainArticle = value;
  }

  bool _articleIsListed = false;
  bool get articleIsListed => _articleIsListed;
  set articleIsListed(bool value) {
    _articleIsListed = value;
  }

  bool _teamIsSelected = false;
  bool get teamIsSelected => _teamIsSelected;
  set teamIsSelected(bool value) {
    _teamIsSelected = value;
    secureStorage.setBool('ff_teamIsSelected', value);
  }

  void deleteTeamIsSelected() {
    secureStorage.delete(key: 'ff_teamIsSelected');
  }

  dynamic _teamSelected;
  dynamic get teamSelected => _teamSelected;
  set teamSelected(dynamic value) {
    _teamSelected = value;
    secureStorage.setString('ff_teamSelected', jsonEncode(value));
  }

  void deleteTeamSelected() {
    secureStorage.delete(key: 'ff_teamSelected');
  }

  String _testphoto = '';
  String get testphoto => _testphoto;
  set testphoto(String value) {
    _testphoto = value;
  }

  List<dynamic> _allEventVar = [];
  List<dynamic> get allEventVar => _allEventVar;
  set allEventVar(List<dynamic> value) {
    _allEventVar = value;
  }

  void addToAllEventVar(dynamic value) {
    allEventVar.add(value);
  }

  void removeFromAllEventVar(dynamic value) {
    allEventVar.remove(value);
  }

  void removeAtIndexFromAllEventVar(int index) {
    allEventVar.removeAt(index);
  }

  void updateAllEventVarAtIndex(
    int index,
    dynamic Function(dynamic) updateFn,
  ) {
    allEventVar[index] = updateFn(_allEventVar[index]);
  }

  void insertAtIndexInAllEventVar(int index, dynamic value) {
    allEventVar.insert(index, value);
  }

  dynamic _mobRunningEvent;
  dynamic get mobRunningEvent => _mobRunningEvent;
  set mobRunningEvent(dynamic value) {
    _mobRunningEvent = value;
  }

  List<dynamic> _varComingEvents = [];
  List<dynamic> get varComingEvents => _varComingEvents;
  set varComingEvents(List<dynamic> value) {
    _varComingEvents = value;
  }

  void addToVarComingEvents(dynamic value) {
    varComingEvents.add(value);
  }

  void removeFromVarComingEvents(dynamic value) {
    varComingEvents.remove(value);
  }

  void removeAtIndexFromVarComingEvents(int index) {
    varComingEvents.removeAt(index);
  }

  void updateVarComingEventsAtIndex(
    int index,
    dynamic Function(dynamic) updateFn,
  ) {
    varComingEvents[index] = updateFn(_varComingEvents[index]);
  }

  void insertAtIndexInVarComingEvents(int index, dynamic value) {
    varComingEvents.insert(index, value);
  }

  /// tqt
  dynamic _dataPicked;
  dynamic get dataPicked => _dataPicked;
  set dataPicked(dynamic value) {
    _dataPicked = value;
  }

  String _calenderFilterTier = '';
  String get calenderFilterTier => _calenderFilterTier;
  set calenderFilterTier(String value) {
    _calenderFilterTier = value;
  }

  String _calenderFilterRegion = '';
  String get calenderFilterRegion => _calenderFilterRegion;
  set calenderFilterRegion(String value) {
    _calenderFilterRegion = value;
  }

  dynamic _favoriteTeam;
  dynamic get favoriteTeam => _favoriteTeam;
  set favoriteTeam(dynamic value) {
    _favoriteTeam = value;
  }

  bool _searchByTeam = false;
  bool get searchByTeam => _searchByTeam;
  set searchByTeam(bool value) {
    _searchByTeam = value;
    secureStorage.setBool('ff_searchByTeam', value);
  }

  void deleteSearchByTeam() {
    secureStorage.delete(key: 'ff_searchByTeam');
  }

  List<dynamic> _ads = [];
  List<dynamic> get ads => _ads;
  set ads(List<dynamic> value) {
    _ads = value;
  }

  void addToAds(dynamic value) {
    ads.add(value);
  }

  void removeFromAds(dynamic value) {
    ads.remove(value);
  }

  void removeAtIndexFromAds(int index) {
    ads.removeAt(index);
  }

  void updateAdsAtIndex(
    int index,
    dynamic Function(dynamic) updateFn,
  ) {
    ads[index] = updateFn(_ads[index]);
  }

  void insertAtIndexInAds(int index, dynamic value) {
    ads.insert(index, value);
  }

  /// All games
  List<dynamic> _gameSelection = [];
  List<dynamic> get gameSelection => _gameSelection;
  set gameSelection(List<dynamic> value) {
    _gameSelection = value;
  }

  void addToGameSelection(dynamic value) {
    gameSelection.add(value);
  }

  void removeFromGameSelection(dynamic value) {
    gameSelection.remove(value);
  }

  void removeAtIndexFromGameSelection(int index) {
    gameSelection.removeAt(index);
  }

  void updateGameSelectionAtIndex(
    int index,
    dynamic Function(dynamic) updateFn,
  ) {
    gameSelection[index] = updateFn(_gameSelection[index]);
  }

  void insertAtIndexInGameSelection(int index, dynamic value) {
    gameSelection.insert(index, value);
  }

  String _gameSelected = '';
  String get gameSelected => _gameSelected;
  set gameSelected(String value) {
    _gameSelected = value;
    secureStorage.setString('ff_gameSelected', value);
  }

  void deleteGameSelected() {
    secureStorage.delete(key: 'ff_gameSelected');
  }

  List<dynamic> _articlesList = [];
  List<dynamic> get articlesList => _articlesList;
  set articlesList(List<dynamic> value) {
    _articlesList = value;
  }

  void addToArticlesList(dynamic value) {
    articlesList.add(value);
  }

  void removeFromArticlesList(dynamic value) {
    articlesList.remove(value);
  }

  void removeAtIndexFromArticlesList(int index) {
    articlesList.removeAt(index);
  }

  void updateArticlesListAtIndex(
    int index,
    dynamic Function(dynamic) updateFn,
  ) {
    articlesList[index] = updateFn(_articlesList[index]);
  }

  void insertAtIndexInArticlesList(int index, dynamic value) {
    articlesList.insert(index, value);
  }
}

void _safeInit(Function() initializeField) {
  try {
    initializeField();
  } catch (_) {}
}

Future _safeInitAsync(Function() initializeField) async {
  try {
    await initializeField();
  } catch (_) {}
}

extension FlutterSecureStorageExtensions on FlutterSecureStorage {
  static final _lock = Lock();

  Future<void> writeSync({required String key, String? value}) async =>
      await _lock.synchronized(() async {
        await write(key: key, value: value);
      });

  void remove(String key) => delete(key: key);

  Future<String?> getString(String key) async => await read(key: key);
  Future<void> setString(String key, String value) async =>
      await writeSync(key: key, value: value);

  Future<bool?> getBool(String key) async => (await read(key: key)) == 'true';
  Future<void> setBool(String key, bool value) async =>
      await writeSync(key: key, value: value.toString());

  Future<int?> getInt(String key) async =>
      int.tryParse(await read(key: key) ?? '');
  Future<void> setInt(String key, int value) async =>
      await writeSync(key: key, value: value.toString());

  Future<double?> getDouble(String key) async =>
      double.tryParse(await read(key: key) ?? '');
  Future<void> setDouble(String key, double value) async =>
      await writeSync(key: key, value: value.toString());

  Future<List<String>?> getStringList(String key) async =>
      await read(key: key).then((result) {
        if (result == null || result.isEmpty) {
          return null;
        }
        return CsvToListConverter()
            .convert(result)
            .first
            .map((e) => e.toString())
            .toList();
      });
  Future<void> setStringList(String key, List<String> value) async =>
      await writeSync(key: key, value: ListToCsvConverter().convert([value]));
}
