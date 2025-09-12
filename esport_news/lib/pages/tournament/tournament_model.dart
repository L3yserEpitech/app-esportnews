import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/components/pc/utils/games_picker_p_c/games_picker_p_c_widget.dart';
import '/components/pc/utils/pc_background_image/pc_background_image_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/index.dart';
import 'tournament_widget.dart' show TournamentWidget;
import 'package:flutter/material.dart';

class TournamentModel extends FlutterFlowModel<TournamentWidget> {
  ///  Local state fields for this page.

  List<dynamic> runningTournament = [];
  void addToRunningTournament(dynamic item) => runningTournament.add(item);
  void removeFromRunningTournament(dynamic item) =>
      runningTournament.remove(item);
  void removeAtIndexFromRunningTournament(int index) =>
      runningTournament.removeAt(index);
  void insertAtIndexInRunningTournament(int index, dynamic item) =>
      runningTournament.insert(index, item);
  void updateRunningTournamentAtIndex(int index, Function(dynamic) updateFn) =>
      runningTournament[index] = updateFn(runningTournament[index]);

  List<dynamic> upcomingTournament = [];
  void addToUpcomingTournament(dynamic item) => upcomingTournament.add(item);
  void removeFromUpcomingTournament(dynamic item) =>
      upcomingTournament.remove(item);
  void removeAtIndexFromUpcomingTournament(int index) =>
      upcomingTournament.removeAt(index);
  void insertAtIndexInUpcomingTournament(int index, dynamic item) =>
      upcomingTournament.insert(index, item);
  void updateUpcomingTournamentAtIndex(int index, Function(dynamic) updateFn) =>
      upcomingTournament[index] = updateFn(upcomingTournament[index]);

  List<dynamic> pastTournament = [];
  void addToPastTournament(dynamic item) => pastTournament.add(item);
  void removeFromPastTournament(dynamic item) => pastTournament.remove(item);
  void removeAtIndexFromPastTournament(int index) =>
      pastTournament.removeAt(index);
  void insertAtIndexInPastTournament(int index, dynamic item) =>
      pastTournament.insert(index, item);
  void updatePastTournamentAtIndex(int index, Function(dynamic) updateFn) =>
      pastTournament[index] = updateFn(pastTournament[index]);

  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Cloud Function - getRunningEvents] action in tournament widget.
  GetRunningEventsCloudFunctionCallResponse? cloudFunction14v;
  // Stores action output result for [Cloud Function - getUpcomingEvents] action in tournament widget.
  GetUpcomingEventsCloudFunctionCallResponse? cloudFunctionl0y;
  // Stores action output result for [Cloud Function - getPastEvents] action in tournament widget.
  GetPastEventsCloudFunctionCallResponse? cloudFunction2mj;
  // Model for pc_background_image component.
  late PcBackgroundImageModel pcBackgroundImageModel;
  // Model for gamesPickerPC component.
  late GamesPickerPCModel gamesPickerPCModel;
  // State field(s) for TabBar widget.
  TabController? tabBarController;
  int get tabBarCurrentIndex =>
      tabBarController != null ? tabBarController!.index : 0;
  int get tabBarPreviousIndex =>
      tabBarController != null ? tabBarController!.previousIndex : 0;

  // Model for navBarPC component.
  late NavBarPCModel navBarPCModel;

  @override
  void initState(BuildContext context) {
    pcBackgroundImageModel =
        createModel(context, () => PcBackgroundImageModel());
    gamesPickerPCModel = createModel(context, () => GamesPickerPCModel());
    navBarPCModel = createModel(context, () => NavBarPCModel());
  }

  @override
  void dispose() {
    pcBackgroundImageModel.dispose();
    gamesPickerPCModel.dispose();
    tabBarController?.dispose();
    navBarPCModel.dispose();
  }
}
