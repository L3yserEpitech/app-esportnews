import '/components/ads_widget.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/mobile/nav/top_bar_mobile_home/top_bar_mobile_home_widget.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/components/pc/utils/pc_background_image/pc_background_image_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'article_widget.dart' show ArticleWidget;
import 'package:flutter/material.dart';

class ArticleModel extends FlutterFlowModel<ArticleWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for pc_background_image component.
  late PcBackgroundImageModel pcBackgroundImageModel;
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
    adsModel = createModel(context, () => AdsModel());
    navBarPCModel = createModel(context, () => NavBarPCModel());
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
    topBarMobileHomeModel = createModel(context, () => TopBarMobileHomeModel());
  }

  @override
  void dispose() {
    pcBackgroundImageModel.dispose();
    adsModel.dispose();
    navBarPCModel.dispose();
    navBarHomeModel.dispose();
    topBarMobileHomeModel.dispose();
  }
}
