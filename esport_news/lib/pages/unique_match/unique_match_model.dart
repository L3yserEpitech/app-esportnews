import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/components/pc/utils/pc_background_image/pc_background_image_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'unique_match_widget.dart' show UniqueMatchWidget;
import 'package:flutter/material.dart';

class UniqueMatchModel extends FlutterFlowModel<UniqueMatchWidget> {
  ///  Local state fields for this page.

  dynamic varMatch;

  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Cloud Function - getMatchById] action in unique_match widget.
  GetMatchByIdCloudFunctionCallResponse? outputGetMatch;
  // State field(s) for TabBar widget.
  TabController? tabBarController;
  int get tabBarCurrentIndex =>
      tabBarController != null ? tabBarController!.index : 0;
  int get tabBarPreviousIndex =>
      tabBarController != null ? tabBarController!.previousIndex : 0;

  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;
  // Model for pc_background_image component.
  late PcBackgroundImageModel pcBackgroundImageModel;
  // Model for navBarPC component.
  late NavBarPCModel navBarPCModel;

  @override
  void initState(BuildContext context) {
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
    pcBackgroundImageModel =
        createModel(context, () => PcBackgroundImageModel());
    navBarPCModel = createModel(context, () => NavBarPCModel());
  }

  @override
  void dispose() {
    tabBarController?.dispose();
    navBarHomeModel.dispose();
    pcBackgroundImageModel.dispose();
    navBarPCModel.dispose();
  }
}
