import '/components/utils/logo/logo_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'nav_bar_p_c_login_widget.dart' show NavBarPCLoginWidget;
import 'package:flutter/material.dart';

class NavBarPCLoginModel extends FlutterFlowModel<NavBarPCLoginWidget> {
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
