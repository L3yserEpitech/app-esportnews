import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'match_live_component_widget.dart' show MatchLiveComponentWidget;
import 'package:flutter/material.dart';

class MatchLiveComponentModel
    extends FlutterFlowModel<MatchLiveComponentWidget> {
  ///  Local state fields for this component.

  List<dynamic> liveMatch = [];
  void addToLiveMatch(dynamic item) => liveMatch.add(item);
  void removeFromLiveMatch(dynamic item) => liveMatch.remove(item);
  void removeAtIndexFromLiveMatch(int index) => liveMatch.removeAt(index);
  void insertAtIndexInLiveMatch(int index, dynamic item) =>
      liveMatch.insert(index, item);
  void updateLiveMatchAtIndex(int index, Function(dynamic) updateFn) =>
      liveMatch[index] = updateFn(liveMatch[index]);

  dynamic teamInfo;

  ///  State fields for stateful widgets in this component.

  // Stores action output result for [Cloud Function - getLiveMatches] action in matchLiveComponent widget.
  GetLiveMatchesCloudFunctionCallResponse? outputGetLiveMatches;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {}
}
