import '/components/utils/logo/logo_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'top_bar_mobile_login_widget.dart' show TopBarMobileLoginWidget;
import 'package:flutter/material.dart';

class TopBarMobileLoginModel extends FlutterFlowModel<TopBarMobileLoginWidget> {
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
