import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/mobile/nav/top_bar_mobile_home/top_bar_mobile_home_widget.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/index.dart';
import 'event_mobile_page_widget.dart' show EventMobilePageWidget;
import 'package:flutter/material.dart';

class EventMobilePageModel extends FlutterFlowModel<EventMobilePageWidget> {
  ///  Local state fields for this page.
  /// tqt
  List<dynamic> runningEvents = [];
  void addToRunningEvents(dynamic item) => runningEvents.add(item);
  void removeFromRunningEvents(dynamic item) => runningEvents.remove(item);
  void removeAtIndexFromRunningEvents(int index) =>
      runningEvents.removeAt(index);
  void insertAtIndexInRunningEvents(int index, dynamic item) =>
      runningEvents.insert(index, item);
  void updateRunningEventsAtIndex(int index, Function(dynamic) updateFn) =>
      runningEvents[index] = updateFn(runningEvents[index]);

  /// tqt
  List<dynamic> upcomingEvents = [];
  void addToUpcomingEvents(dynamic item) => upcomingEvents.add(item);
  void removeFromUpcomingEvents(dynamic item) => upcomingEvents.remove(item);
  void removeAtIndexFromUpcomingEvents(int index) =>
      upcomingEvents.removeAt(index);
  void insertAtIndexInUpcomingEvents(int index, dynamic item) =>
      upcomingEvents.insert(index, item);
  void updateUpcomingEventsAtIndex(int index, Function(dynamic) updateFn) =>
      upcomingEvents[index] = updateFn(upcomingEvents[index]);

  /// tqt
  List<dynamic> pastEvents = [];
  void addToPastEvents(dynamic item) => pastEvents.add(item);
  void removeFromPastEvents(dynamic item) => pastEvents.remove(item);
  void removeAtIndexFromPastEvents(int index) => pastEvents.removeAt(index);
  void insertAtIndexInPastEvents(int index, dynamic item) =>
      pastEvents.insert(index, item);
  void updatePastEventsAtIndex(int index, Function(dynamic) updateFn) =>
      pastEvents[index] = updateFn(pastEvents[index]);

  ///  State fields for stateful widgets in this page.

  // Stores action output result for [Cloud Function - getRunningEvents] action in event_mobile_page widget.
  GetRunningEventsCloudFunctionCallResponse? cloudFunction14v;
  // Stores action output result for [Cloud Function - getUpcomingEvents] action in event_mobile_page widget.
  GetUpcomingEventsCloudFunctionCallResponse? cloudFunctionl0y;
  // Stores action output result for [Cloud Function - getPastEvents] action in event_mobile_page widget.
  GetPastEventsCloudFunctionCallResponse? cloudFunction2mj;
  // State field(s) for TabBar widget.
  TabController? tabBarController;
  int get tabBarCurrentIndex =>
      tabBarController != null ? tabBarController!.index : 0;
  int get tabBarPreviousIndex =>
      tabBarController != null ? tabBarController!.previousIndex : 0;

  // Model for topBar_mobile_home component.
  late TopBarMobileHomeModel topBarMobileHomeModel;
  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;

  @override
  void initState(BuildContext context) {
    topBarMobileHomeModel = createModel(context, () => TopBarMobileHomeModel());
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
  }

  @override
  void dispose() {
    tabBarController?.dispose();
    topBarMobileHomeModel.dispose();
    navBarHomeModel.dispose();
  }
}
