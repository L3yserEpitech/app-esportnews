import '/components/pc/nav/nav_bar_p_c_connected/nav_bar_p_c_connected_widget.dart';
import '/components/pc/nav/nav_bar_p_c_signup/nav_bar_p_c_signup_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'nav_bar_p_c_widget.dart' show NavBarPCWidget;
import 'package:flutter/material.dart';

class NavBarPCModel extends FlutterFlowModel<NavBarPCWidget> {
  ///  State fields for stateful widgets in this component.

  // Model for navBarPC-connected component.
  late NavBarPCConnectedModel navBarPCConnectedModel;
  // Model for navBarPC-signup component.
  late NavBarPCSignupModel navBarPCSignupModel;

  @override
  void initState(BuildContext context) {
    navBarPCConnectedModel =
        createModel(context, () => NavBarPCConnectedModel());
    navBarPCSignupModel = createModel(context, () => NavBarPCSignupModel());
  }

  @override
  void dispose() {
    navBarPCConnectedModel.dispose();
    navBarPCSignupModel.dispose();
  }
}
