import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/components/pc/utils/pc_background_image/pc_background_image_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/index.dart';
import 'unique_event_widget.dart' show UniqueEventWidget;
import 'package:flutter/material.dart';

class UniqueEventModel extends FlutterFlowModel<UniqueEventWidget> {
  ///  State fields for stateful widgets in this page.

  // State field(s) for TabBar widget.
  TabController? tabBarController;
  int get tabBarCurrentIndex =>
      tabBarController != null ? tabBarController!.index : 0;
  int get tabBarPreviousIndex =>
      tabBarController != null ? tabBarController!.previousIndex : 0;

  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;
  // Model for navBarPC component.
  late NavBarPCModel navBarPCModel;
  // Model for pc_background_image component.
  late PcBackgroundImageModel pcBackgroundImageModel;

  @override
  void initState(BuildContext context) {
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
    navBarPCModel = createModel(context, () => NavBarPCModel());
    pcBackgroundImageModel =
        createModel(context, () => PcBackgroundImageModel());
  }

  @override
  void dispose() {
    tabBarController?.dispose();
    navBarHomeModel.dispose();
    navBarPCModel.dispose();
    pcBackgroundImageModel.dispose();
  }
}
