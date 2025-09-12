import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'modal_search_team_mobile_widget.dart' show ModalSearchTeamMobileWidget;
import 'package:flutter/material.dart';

class ModalSearchTeamMobileModel
    extends FlutterFlowModel<ModalSearchTeamMobileWidget> {
  ///  Local state fields for this component.

  bool delBlank = false;

  ///  State fields for stateful widgets in this component.

  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode;
  TextEditingController? textController;
  String? Function(BuildContext, String?)? textControllerValidator;
  // Stores action output result for [Cloud Function - searchTeam] action in TextField widget.
  SearchTeamCloudFunctionCallResponse? outputSearchTeam;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    textFieldFocusNode?.dispose();
    textController?.dispose();
  }
}
