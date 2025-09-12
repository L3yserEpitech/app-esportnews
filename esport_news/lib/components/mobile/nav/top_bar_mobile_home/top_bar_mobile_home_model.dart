import '/components/utils/logo/logo_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'top_bar_mobile_home_widget.dart' show TopBarMobileHomeWidget;
import 'package:flutter/material.dart';

class TopBarMobileHomeModel extends FlutterFlowModel<TopBarMobileHomeWidget> {
  ///  State fields for stateful widgets in this component.

  // Model for logo component.
  late LogoModel logoModel;

  @override
  void initState(BuildContext context) {
    logoModel = createModel(context, () => LogoModel());
  }

  @override
  void dispose() {
    logoModel.dispose();
  }
}
