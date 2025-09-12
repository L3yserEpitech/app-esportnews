import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'stream_page_widget.dart' show StreamPageWidget;
import 'package:flutter/material.dart';

class StreamPageModel extends FlutterFlowModel<StreamPageWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;

  @override
  void initState(BuildContext context) {
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
  }

  @override
  void dispose() {
    navBarHomeModel.dispose();
  }
}
