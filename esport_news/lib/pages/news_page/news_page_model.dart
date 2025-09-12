import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'news_page_widget.dart' show NewsPageWidget;
import 'package:flutter/material.dart';

class NewsPageModel extends FlutterFlowModel<NewsPageWidget> {
  ///  State fields for stateful widgets in this page.

  // Model for navBarPC component.
  late NavBarPCModel navBarPCModel;

  @override
  void initState(BuildContext context) {
    navBarPCModel = createModel(context, () => NavBarPCModel());
  }

  @override
  void dispose() {
    navBarPCModel.dispose();
  }
}
