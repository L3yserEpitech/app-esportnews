import '/components/pc/nav/nav_bar_p_c_connected/nav_bar_p_c_connected_widget.dart';
import '/components/pc/nav/nav_bar_p_c_signup/nav_bar_p_c_signup_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'nav_bar_p_c_model.dart';
export 'nav_bar_p_c_model.dart';

class NavBarPCWidget extends StatefulWidget {
  const NavBarPCWidget({super.key});

  @override
  State<NavBarPCWidget> createState() => _NavBarPCWidgetState();
}

class _NavBarPCWidgetState extends State<NavBarPCWidget> {
  late NavBarPCModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => NavBarPCModel());

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<FFAppState>();

    return Builder(
      builder: (context) {
        if (FFAppState().isConnected) {
          return wrapWithModel(
            model: _model.navBarPCConnectedModel,
            updateCallback: () => safeSetState(() {}),
            child: NavBarPCConnectedWidget(),
          );
        } else {
          return wrapWithModel(
            model: _model.navBarPCSignupModel,
            updateCallback: () => safeSetState(() {}),
            child: NavBarPCSignupWidget(),
          );
        }
      },
    );
  }
}
