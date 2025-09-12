import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'games_picker_p_c_widget.dart' show GamesPickerPCWidget;
import 'package:flutter/material.dart';

class GamesPickerPCModel extends FlutterFlowModel<GamesPickerPCWidget> {
  ///  Local state fields for this component.
  /// ee
  List<dynamic> allTeams = [];
  void addToAllTeams(dynamic item) => allTeams.add(item);
  void removeFromAllTeams(dynamic item) => allTeams.remove(item);
  void removeAtIndexFromAllTeams(int index) => allTeams.removeAt(index);
  void insertAtIndexInAllTeams(int index, dynamic item) =>
      allTeams.insert(index, item);
  void updateAllTeamsAtIndex(int index, Function(dynamic) updateFn) =>
      allTeams[index] = updateFn(allTeams[index]);

  /// ee
  List<int> loopTeams = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  void addToLoopTeams(int item) => loopTeams.add(item);
  void removeFromLoopTeams(int item) => loopTeams.remove(item);
  void removeAtIndexFromLoopTeams(int index) => loopTeams.removeAt(index);
  void insertAtIndexInLoopTeams(int index, int item) =>
      loopTeams.insert(index, item);
  void updateLoopTeamsAtIndex(int index, Function(int) updateFn) =>
      loopTeams[index] = updateFn(loopTeams[index]);

  ///  State fields for stateful widgets in this component.

  // Stores action output result for [Cloud Function - newGetGamesSelection] action in gamesPickerPC widget.
  NewGetGamesSelectionCloudFunctionCallResponse? cloudFunctionm4j;

  @override
  void initState(BuildContext context) {}

  @override
  void dispose() {}
}
