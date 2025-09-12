import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/mobile/nav/top_bar_mobile_home/top_bar_mobile_home_widget.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/components/pc/utils/data_calendar_p_c/data_calendar_p_c_widget.dart';
import '/components/pc/utils/games_picker_p_c/games_picker_p_c_widget.dart';
import '/components/pc/utils/pc_background_image/pc_background_image_widget.dart';
import '/flutter_flow/flutter_flow_calendar.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/flutter_flow/form_field_controller.dart';
import 'calendar_widget.dart' show CalendarWidget;
import 'package:flutter/material.dart';

class CalendarModel extends FlutterFlowModel<CalendarWidget> {
  ///  State fields for stateful widgets in this page.

  // State field(s) for Calendar widget.
  DateTimeRange? calendarSelectedDay1;
  // Model for navBar_home component.
  late NavBarHomeModel navBarHomeModel;
  // Model for topBar_mobile_home component.
  late TopBarMobileHomeModel topBarMobileHomeModel;
  // Model for pc_background_image component.
  late PcBackgroundImageModel pcBackgroundImageModel;
  // Model for navBarPC component.
  late NavBarPCModel navBarPCModel;
  // Model for gamesPickerPC component.
  late GamesPickerPCModel gamesPickerPCModel;
  // State field(s) for Calendar widget.
  DateTimeRange? calendarSelectedDay2;
  // Stores action output result for [Cloud Function - getEventsByDate] action in Calendar widget.
  GetEventsByDateCloudFunctionCallResponse? cloudFunctionw2u;
  // State field(s) for DropDown widget.
  String? dropDownValue1;
  FormFieldController<String>? dropDownValueController1;
  // State field(s) for DropDown widget.
  String? dropDownValue2;
  FormFieldController<String>? dropDownValueController2;
  // Model for dataCalendarPC component.
  late DataCalendarPCModel dataCalendarPCModel;

  @override
  void initState(BuildContext context) {
    calendarSelectedDay1 = DateTimeRange(
      start: DateTime.now().startOfDay,
      end: DateTime.now().endOfDay,
    );
    navBarHomeModel = createModel(context, () => NavBarHomeModel());
    topBarMobileHomeModel = createModel(context, () => TopBarMobileHomeModel());
    pcBackgroundImageModel =
        createModel(context, () => PcBackgroundImageModel());
    navBarPCModel = createModel(context, () => NavBarPCModel());
    gamesPickerPCModel = createModel(context, () => GamesPickerPCModel());
    calendarSelectedDay2 = DateTimeRange(
      start: DateTime.now().startOfDay,
      end: DateTime.now().endOfDay,
    );
    dataCalendarPCModel = createModel(context, () => DataCalendarPCModel());
  }

  @override
  void dispose() {
    navBarHomeModel.dispose();
    topBarMobileHomeModel.dispose();
    pcBackgroundImageModel.dispose();
    navBarPCModel.dispose();
    gamesPickerPCModel.dispose();
    dataCalendarPCModel.dispose();
  }
}
