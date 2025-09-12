import '/backend/api_requests/api_calls.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/mobile/nav/top_bar_mobile_login/top_bar_mobile_login_widget.dart';
import '/components/pc/nav/nav_bar_p_c_login/nav_bar_p_c_login_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/index.dart';
import 'login_widget.dart' show LoginWidget;
import 'package:flutter/material.dart';

class LoginModel extends FlutterFlowModel<LoginWidget> {
  ///  State fields for stateful widgets in this page.

  // State field(s) for emailAddress widget.
  FocusNode? emailAddressFocusNode1;
  TextEditingController? emailAddressTextController1;
  String? Function(BuildContext, String?)? emailAddressTextController1Validator;
  // State field(s) for password widget.
  FocusNode? passwordFocusNode1;
  TextEditingController? passwordTextController1;
  late bool passwordVisibility1;
  String? Function(BuildContext, String?)? passwordTextController1Validator;
  // Stores action output result for [Backend Call - API (Login)] action in Button widget.
  ApiCallResponse? outputBody;
  // Stores action output result for [Backend Call - API (Auth to User)] action in Button widget.
  ApiCallResponse? outputApiAuthToUser;
  // Model for topBar_Mobile_login component.
  late TopBarMobileLoginModel topBarMobileLoginModel;
  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;
  // Model for navBarPC-login component.
  late NavBarPCLoginModel navBarPCLoginModel;
  // State field(s) for emailAddress widget.
  FocusNode? emailAddressFocusNode2;
  TextEditingController? emailAddressTextController2;
  String? Function(BuildContext, String?)? emailAddressTextController2Validator;
  // State field(s) for password widget.
  FocusNode? passwordFocusNode2;
  TextEditingController? passwordTextController2;
  late bool passwordVisibility2;
  String? Function(BuildContext, String?)? passwordTextController2Validator;
  // Stores action output result for [Backend Call - API (Login)] action in Button widget.
  ApiCallResponse? outputBodyM;
  // Stores action output result for [Backend Call - API (Auth to User)] action in Button widget.
  ApiCallResponse? outputApiAuthToUserM;

  @override
  void initState(BuildContext context) {
    passwordVisibility1 = false;
    topBarMobileLoginModel =
        createModel(context, () => TopBarMobileLoginModel());
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
    navBarPCLoginModel = createModel(context, () => NavBarPCLoginModel());
    passwordVisibility2 = false;
  }

  @override
  void dispose() {
    emailAddressFocusNode1?.dispose();
    emailAddressTextController1?.dispose();

    passwordFocusNode1?.dispose();
    passwordTextController1?.dispose();

    topBarMobileLoginModel.dispose();
    navBarHomeModel.dispose();
    navBarPCLoginModel.dispose();
    emailAddressFocusNode2?.dispose();
    emailAddressTextController2?.dispose();

    passwordFocusNode2?.dispose();
    passwordTextController2?.dispose();
  }
}
