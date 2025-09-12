import '/backend/api_requests/api_calls.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/form_field_controller.dart';
import '/index.dart';
import 'profil_widget.dart' show ProfilWidget;
import 'package:flutter/material.dart';

class ProfilModel extends FlutterFlowModel<ProfilWidget> {
  ///  Local state fields for this page.
  /// state notification
  bool? notif = true;

  /// state games
  bool games = false;

  /// state teams
  bool teams = false;

  String? newPassword;

  bool settingsPreference = false;

  bool settings = true;

  ///  State fields for stateful widgets in this page.

  // State field(s) for DropDown widget.
  String? dropDownValue;
  FormFieldController<String>? dropDownValueController;
  bool isDataUploading_dataImage = false;
  FFUploadedFile uploadedLocalFile_dataImage =
      FFUploadedFile(bytes: Uint8List.fromList([]));

  // State field(s) for nameTextField widget.
  final nameTextFieldKey = GlobalKey();
  FocusNode? nameTextFieldFocusNode;
  TextEditingController? nameTextFieldTextController;
  String? nameTextFieldSelectedOption;
  String? Function(BuildContext, String?)? nameTextFieldTextControllerValidator;
  // State field(s) for emailTextField widget.
  final emailTextFieldKey = GlobalKey();
  FocusNode? emailTextFieldFocusNode;
  TextEditingController? emailTextFieldTextController;
  String? emailTextFieldSelectedOption;
  String? Function(BuildContext, String?)?
      emailTextFieldTextControllerValidator;
  // State field(s) for passwordTextField widget.
  FocusNode? passwordTextFieldFocusNode;
  TextEditingController? passwordTextFieldTextController;
  late bool passwordTextFieldVisibility;
  String? Function(BuildContext, String?)?
      passwordTextFieldTextControllerValidator;
  // Stores action output result for [Backend Call - API (Updata user profile metadata)] action in Button widget.
  ApiCallResponse? outputUpdateApi;
  // Stores action output result for [Backend Call - API (Upload profile picture)] action in Button widget.
  ApiCallResponse? outputProfilePictureUpload;
  // Stores action output result for [Backend Call - API (Auth to User)] action in Button widget.
  ApiCallResponse? outputApiAuthPhoto;
  // State field(s) for TabBar widget.
  TabController? tabBarController1;
  int get tabBarCurrentIndex1 =>
      tabBarController1 != null ? tabBarController1!.index : 0;
  int get tabBarPreviousIndex1 =>
      tabBarController1 != null ? tabBarController1!.previousIndex : 0;

  // Model for navBarPC component.
  late NavBarPCModel navBarPCModel;
  // State field(s) for TabBar widget.
  TabController? tabBarController2;
  int get tabBarCurrentIndex2 =>
      tabBarController2 != null ? tabBarController2!.index : 0;
  int get tabBarPreviousIndex2 =>
      tabBarController2 != null ? tabBarController2!.previousIndex : 0;

  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;

  @override
  void initState(BuildContext context) {
    passwordTextFieldVisibility = false;
    navBarPCModel = createModel(context, () => NavBarPCModel());
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
  }

  @override
  void dispose() {
    nameTextFieldFocusNode?.dispose();

    emailTextFieldFocusNode?.dispose();

    passwordTextFieldFocusNode?.dispose();
    passwordTextFieldTextController?.dispose();

    tabBarController1?.dispose();
    navBarPCModel.dispose();
    tabBarController2?.dispose();
    navBarHomeModel.dispose();
  }
}
