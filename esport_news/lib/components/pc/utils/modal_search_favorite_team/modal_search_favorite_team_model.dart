import '/backend/api_requests/api_calls.dart';
import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'modal_search_favorite_team_widget.dart'
    show ModalSearchFavoriteTeamWidget;
import 'package:flutter/material.dart';

class ModalSearchFavoriteTeamModel
    extends FlutterFlowModel<ModalSearchFavoriteTeamWidget> {
  ///  Local state fields for this component.

  bool delBlanck = false;

  ///  State fields for stateful widgets in this component.

  // State field(s) for TextField widget.
  FocusNode? textFieldFocusNode;
  TextEditingController? textController;
  String? Function(BuildContext, String?)? textControllerValidator;
  // Stores action output result for [Cloud Function - searchTeam] action in TextField widget.
  SearchTeamCloudFunctionCallResponse? outputSearchTeam;
  // Stores action output result for [Backend Call - API (modify fav team)] action in Container widget.
  ApiCallResponse? apiResulth91;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {
    textFieldFocusNode?.dispose();
    textController?.dispose();
  }
}
