import '/backend/api_requests/api_calls.dart';
import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/components/ads_widget.dart';
import '/components/event_container/event_container_widget.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/mobile/nav/top_bar_mobile_home/top_bar_mobile_home_widget.dart';
import '/components/mobile/utils/match_live_component_mobile/match_live_component_mobile_widget.dart';
import '/components/news_widget.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/components/pc/utils/games_picker_p_c/games_picker_p_c_widget.dart';
import '/components/pc/utils/home_event_container/home_event_container_widget.dart';
import '/components/pc/utils/match_live_component/match_live_component_widget.dart';
import '/components/pc/utils/pc_background_image/pc_background_image_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'home_widget.dart' show HomeWidget;
import 'package:flutter/material.dart';

class HomeModel extends FlutterFlowModel<HomeWidget> {
  ///  Local state fields for this page.

  List<dynamic> listTeams = [];
  void addToListTeams(dynamic item) => listTeams.add(item);
  void removeFromListTeams(dynamic item) => listTeams.remove(item);
  void removeAtIndexFromListTeams(int index) => listTeams.removeAt(index);
  void insertAtIndexInListTeams(int index, dynamic item) =>
      listTeams.insert(index, item);
  void updateListTeamsAtIndex(int index, Function(dynamic) updateFn) =>
      listTeams[index] = updateFn(listTeams[index]);

  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Backend Call - API (Auth to User)] action in Home widget.
  ApiCallResponse? outputReceiveDataUser;
  // Stores action output result for [Backend Call - API (Fetch all teams)] action in Home widget.
  ApiCallResponse? apiResultxht;
  // Stores action output result for [Cloud Function - getActiveAds] action in Home widget.
  GetActiveAdsCloudFunctionCallResponse? cloudFunction2ap;
  // Model for matchLiveComponentMobile component.
  late MatchLiveComponentMobileModel matchLiveComponentMobileModel;
  // Model for event_container component.
  late EventContainerModel eventContainerModel;
  // Model for topBar_mobile_home component.
  late TopBarMobileHomeModel topBarMobileHomeModel;
  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;
  // Model for pc_background_image component.
  late PcBackgroundImageModel pcBackgroundImageModel;
  // Model for gamesPickerPC component.
  late GamesPickerPCModel gamesPickerPCModel;
  // Model for matchLiveComponent component.
  late MatchLiveComponentModel matchLiveComponentModel;
  // Model for news component.
  late NewsModel newsModel;
  // Model for home_event_container component.
  late HomeEventContainerModel homeEventContainerModel;
  // Model for ads component.
  late AdsModel adsModel;
  // Model for navBarPC component.
  late NavBarPCModel navBarPCModel;

  @override
  void initState(BuildContext context) {
    matchLiveComponentMobileModel =
        createModel(context, () => MatchLiveComponentMobileModel());
    eventContainerModel = createModel(context, () => EventContainerModel());
    topBarMobileHomeModel = createModel(context, () => TopBarMobileHomeModel());
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
    pcBackgroundImageModel =
        createModel(context, () => PcBackgroundImageModel());
    gamesPickerPCModel = createModel(context, () => GamesPickerPCModel());
    matchLiveComponentModel =
        createModel(context, () => MatchLiveComponentModel());
    newsModel = createModel(context, () => NewsModel());
    homeEventContainerModel =
        createModel(context, () => HomeEventContainerModel());
    adsModel = createModel(context, () => AdsModel());
    navBarPCModel = createModel(context, () => NavBarPCModel());
  }

  @override
  void dispose() {
    matchLiveComponentMobileModel.dispose();
    eventContainerModel.dispose();
    topBarMobileHomeModel.dispose();
    navBarHomeModel.dispose();
    pcBackgroundImageModel.dispose();
    gamesPickerPCModel.dispose();
    matchLiveComponentModel.dispose();
    newsModel.dispose();
    homeEventContainerModel.dispose();
    adsModel.dispose();
    navBarPCModel.dispose();
  }
}
