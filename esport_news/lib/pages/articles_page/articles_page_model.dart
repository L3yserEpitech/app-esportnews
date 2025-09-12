import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/components/ads_widget.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/mobile/nav/top_bar_mobile_home/top_bar_mobile_home_widget.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/components/pc/utils/games_picker_p_c/games_picker_p_c_widget.dart';
import '/components/pc/utils/pc_background_image/pc_background_image_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/index.dart';
import 'articles_page_widget.dart' show ArticlesPageWidget;
import 'package:flutter/material.dart';

class ArticlesPageModel extends FlutterFlowModel<ArticlesPageWidget> {
  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Cloud Function - getArticles] action in ArticlesPage widget.
  GetArticlesCloudFunctionCallResponse? cloudFunction8do;
  // Model for pc_background_image component.
  late PcBackgroundImageModel pcBackgroundImageModel;
  // Model for gamesPickerPC component.
  late GamesPickerPCModel gamesPickerPCModel;
  // Model for ads component.
  late AdsModel adsModel;
  // Model for navBarPC component.
  late NavBarPCModel navBarPCModel;
  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;
  // Model for topBar_mobile_home component.
  late TopBarMobileHomeModel topBarMobileHomeModel;

  @override
  void initState(BuildContext context) {
    pcBackgroundImageModel =
        createModel(context, () => PcBackgroundImageModel());
    gamesPickerPCModel = createModel(context, () => GamesPickerPCModel());
    adsModel = createModel(context, () => AdsModel());
    navBarPCModel = createModel(context, () => NavBarPCModel());
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
    topBarMobileHomeModel = createModel(context, () => TopBarMobileHomeModel());
  }

  @override
  void dispose() {
    pcBackgroundImageModel.dispose();
    gamesPickerPCModel.dispose();
    adsModel.dispose();
    navBarPCModel.dispose();
    navBarHomeModel.dispose();
    topBarMobileHomeModel.dispose();
  }
}
