import '/backend/api_requests/api_calls.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/mobile/nav/top_bar_mobile_signup/top_bar_mobile_signup_widget.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/index.dart';
import 'sign_up_widget.dart' show SignUpWidget;
import 'package:flutter/material.dart';

class SignUpModel extends FlutterFlowModel<SignUpWidget> {
  ///  State fields for stateful widgets in this page.

  // State field(s) for userName widget.
  FocusNode? userNameFocusNode1;
  TextEditingController? userNameTextController1;
  String? Function(BuildContext, String?)? userNameTextController1Validator;
  // State field(s) for emailAddress widget.
  FocusNode? emailAddressFocusNode1;
  TextEditingController? emailAddressTextController1;
  String? Function(BuildContext, String?)? emailAddressTextController1Validator;
  // State field(s) for password widget.
  FocusNode? passwordFocusNode1;
  TextEditingController? passwordTextController1;
  late bool passwordVisibility1;
  String? Function(BuildContext, String?)? passwordTextController1Validator;
  // State field(s) for confirmPassword widget.
  FocusNode? confirmPasswordFocusNode1;
  TextEditingController? confirmPasswordTextController1;
  late bool confirmPasswordVisibility1;
  String? Function(BuildContext, String?)?
      confirmPasswordTextController1Validator;
  // Stores action output result for [Backend Call - API (Signup)] action in Button widget.
  ApiCallResponse? outputSignUp;
  // Stores action output result for [Backend Call - API (Auth to User)] action in Button widget.
  ApiCallResponse? outputAuthUser;
  // Model for topBar_mobile_signup component.
  late TopBarMobileSignupModel topBarMobileSignupModel;
  // State field(s) for userName widget.
  FocusNode? userNameFocusNode2;
  TextEditingController? userNameTextController2;
  String? Function(BuildContext, String?)? userNameTextController2Validator;
  // State field(s) for emailAddress widget.
  FocusNode? emailAddressFocusNode2;
  TextEditingController? emailAddressTextController2;
  String? Function(BuildContext, String?)? emailAddressTextController2Validator;
  // State field(s) for password widget.
  FocusNode? passwordFocusNode2;
  TextEditingController? passwordTextController2;
  late bool passwordVisibility2;
  String? Function(BuildContext, String?)? passwordTextController2Validator;
  // State field(s) for confirmPassword widget.
  FocusNode? confirmPasswordFocusNode2;
  TextEditingController? confirmPasswordTextController2;
  late bool confirmPasswordVisibility2;
  String? Function(BuildContext, String?)?
      confirmPasswordTextController2Validator;
  // Stores action output result for [Backend Call - API (Signup)] action in Button widget.
  ApiCallResponse? outputSignUpM;
  // Stores action output result for [Backend Call - API (Auth to User)] action in Button widget.
  ApiCallResponse? outputAuthUserM;
  // Model for navBarPC component.
  late NavBarPCModel navBarPCModel;
  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;

  @override
  void initState(BuildContext context) {
    passwordVisibility1 = false;
    confirmPasswordVisibility1 = false;
    topBarMobileSignupModel =
        createModel(context, () => TopBarMobileSignupModel());
    passwordVisibility2 = false;
    confirmPasswordVisibility2 = false;
    navBarPCModel = createModel(context, () => NavBarPCModel());
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
  }

  @override
  void dispose() {
    userNameFocusNode1?.dispose();
    userNameTextController1?.dispose();

    emailAddressFocusNode1?.dispose();
    emailAddressTextController1?.dispose();

    passwordFocusNode1?.dispose();
    passwordTextController1?.dispose();

    confirmPasswordFocusNode1?.dispose();
    confirmPasswordTextController1?.dispose();

    topBarMobileSignupModel.dispose();
    userNameFocusNode2?.dispose();
    userNameTextController2?.dispose();

    emailAddressFocusNode2?.dispose();
    emailAddressTextController2?.dispose();

    passwordFocusNode2?.dispose();
    passwordTextController2?.dispose();

    confirmPasswordFocusNode2?.dispose();
    confirmPasswordTextController2?.dispose();

    navBarPCModel.dispose();
    navBarHomeModel.dispose();
  }
}
