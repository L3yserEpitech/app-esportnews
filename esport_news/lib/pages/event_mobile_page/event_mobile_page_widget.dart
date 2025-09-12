import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/mobile/nav/top_bar_mobile_home/top_bar_mobile_home_widget.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'dart:ui';
import '/index.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'event_mobile_page_model.dart';
export 'event_mobile_page_model.dart';

class EventMobilePageWidget extends StatefulWidget {
  const EventMobilePageWidget({super.key});

  static String routeName = 'event_mobile_page';
  static String routePath = '/eventMobilePage';

  @override
  State<EventMobilePageWidget> createState() => _EventMobilePageWidgetState();
}

class _EventMobilePageWidgetState extends State<EventMobilePageWidget>
    with TickerProviderStateMixin {
  late EventMobilePageModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => EventMobilePageModel());

    // On page load action.
    SchedulerBinding.instance.addPostFrameCallback((_) async {
      await Future.wait([
        Future(() async {
          try {
            final result =
                await FirebaseFunctions.instanceFor(region: 'europe-west1')
                    .httpsCallable('getRunningEvents')
                    .call({
              "game": () {
                if (FFAppState().csSelected) {
                  return 'csgo';
                } else if (FFAppState().fifaSelected) {
                  return 'fifa';
                } else if (FFAppState().dotaSelected) {
                  return 'dota2';
                } else if (FFAppState().lolSelected) {
                  return 'lol';
                } else {
                  return null;
                }
              }(),
              "team": () {
                if (FFAppState().searchByTeam == false) {
                  return null;
                } else if (FFAppState().teamIsSelected == true) {
                  return getJsonField(
                    FFAppState().teamSelected,
                    r'''$.id''',
                  );
                } else if (getJsonField(
                      FFAppState().favoriteTeam,
                      r'''$''',
                    ) !=
                    null) {
                  return getJsonField(
                    FFAppState().favoriteTeam,
                    r'''$.id''',
                  );
                } else {
                  return null;
                }
              }(),
            });
            _model.cloudFunction14v = GetRunningEventsCloudFunctionCallResponse(
              data: (result.data as List?)?.map((i) => i as dynamic).toList(),
              succeeded: true,
              resultAsString: result.data.toString(),
              jsonBody: result.data,
            );
          } on FirebaseFunctionsException catch (error) {
            _model.cloudFunction14v = GetRunningEventsCloudFunctionCallResponse(
              errorCode: error.code,
              succeeded: false,
            );
          }

          _model.runningEvents =
              _model.cloudFunction14v!.jsonBody!.toList().cast<dynamic>();
        }),
        Future(() async {
          try {
            final result =
                await FirebaseFunctions.instanceFor(region: 'europe-west1')
                    .httpsCallable('getUpcomingEvents')
                    .call({
              "game": () {
                if (FFAppState().csSelected) {
                  return 'csgo';
                } else if (FFAppState().fifaSelected) {
                  return 'fifa';
                } else if (FFAppState().dotaSelected) {
                  return 'dota2';
                } else if (FFAppState().lolSelected) {
                  return 'lol';
                } else {
                  return null;
                }
              }(),
              "team": () {
                if (FFAppState().searchByTeam == false) {
                  return null;
                } else if (FFAppState().teamIsSelected == true) {
                  return getJsonField(
                    FFAppState().teamSelected,
                    r'''$.id''',
                  );
                } else if (getJsonField(
                      FFAppState().favoriteTeam,
                      r'''$''',
                    ) !=
                    null) {
                  return getJsonField(
                    FFAppState().favoriteTeam,
                    r'''$.id''',
                  );
                } else {
                  return null;
                }
              }(),
            });
            _model.cloudFunctionl0y =
                GetUpcomingEventsCloudFunctionCallResponse(
              data: (result.data as List?)?.map((i) => i as dynamic).toList(),
              succeeded: true,
              resultAsString: result.data.toString(),
              jsonBody: result.data,
            );
          } on FirebaseFunctionsException catch (error) {
            _model.cloudFunctionl0y =
                GetUpcomingEventsCloudFunctionCallResponse(
              errorCode: error.code,
              succeeded: false,
            );
          }

          _model.upcomingEvents =
              _model.cloudFunctionl0y!.jsonBody!.toList().cast<dynamic>();
        }),
        Future(() async {
          try {
            final result =
                await FirebaseFunctions.instanceFor(region: 'europe-west1')
                    .httpsCallable('getPastEvents')
                    .call({
              "game": () {
                if (FFAppState().csSelected) {
                  return 'csgo';
                } else if (FFAppState().fifaSelected) {
                  return 'fifa';
                } else if (FFAppState().dotaSelected) {
                  return 'dota2';
                } else if (FFAppState().lolSelected) {
                  return 'lol';
                } else {
                  return null;
                }
              }(),
              "team": () {
                if (FFAppState().searchByTeam == false) {
                  return null;
                } else if (FFAppState().teamIsSelected == true) {
                  return getJsonField(
                    FFAppState().teamSelected,
                    r'''$.id''',
                  );
                } else if (getJsonField(
                      FFAppState().favoriteTeam,
                      r'''$''',
                    ) !=
                    null) {
                  return getJsonField(
                    FFAppState().favoriteTeam,
                    r'''$.id''',
                  );
                } else {
                  return null;
                }
              }(),
            });
            _model.cloudFunction2mj = GetPastEventsCloudFunctionCallResponse(
              data: (result.data as List?)?.map((i) => i as dynamic).toList(),
              succeeded: true,
              resultAsString: result.data.toString(),
              jsonBody: result.data,
            );
          } on FirebaseFunctionsException catch (error) {
            _model.cloudFunction2mj = GetPastEventsCloudFunctionCallResponse(
              errorCode: error.code,
              succeeded: false,
            );
          }

          _model.pastEvents =
              _model.cloudFunction2mj!.jsonBody!.toList().cast<dynamic>();
        }),
      ]);
      safeSetState(() {});
    });

    _model.tabBarController = TabController(
      vsync: this,
      length: 3,
      initialIndex: 0,
    )..addListener(() => safeSetState(() {}));

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.dispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<FFAppState>();

    return GestureDetector(
      onTap: () {
        FocusScope.of(context).unfocus();
        FocusManager.instance.primaryFocus?.unfocus();
      },
      child: Scaffold(
        key: scaffoldKey,
        backgroundColor: FlutterFlowTheme.of(context).primary,
        body: Visibility(
          visible: responsiveVisibility(
            context: context,
            desktop: false,
          ),
          child: Container(
            decoration: BoxDecoration(),
            child: Stack(
              children: [
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(0.0, 130.0, 0.0, 0.0),
                  child: Column(
                    children: [
                      Align(
                        alignment: Alignment(0.0, 0),
                        child: TabBar(
                          labelColor: FlutterFlowTheme.of(context).primaryText,
                          unselectedLabelColor:
                              FlutterFlowTheme.of(context).secondaryText,
                          labelStyle:
                              FlutterFlowTheme.of(context).titleMedium.override(
                                    font: GoogleFonts.dmSans(
                                      fontWeight: FlutterFlowTheme.of(context)
                                          .titleMedium
                                          .fontWeight,
                                      fontStyle: FlutterFlowTheme.of(context)
                                          .titleMedium
                                          .fontStyle,
                                    ),
                                    fontSize: 14.0,
                                    letterSpacing: 0.0,
                                    fontWeight: FlutterFlowTheme.of(context)
                                        .titleMedium
                                        .fontWeight,
                                    fontStyle: FlutterFlowTheme.of(context)
                                        .titleMedium
                                        .fontStyle,
                                  ),
                          unselectedLabelStyle: TextStyle(),
                          indicatorColor:
                              FlutterFlowTheme.of(context).secondary,
                          indicatorWeight: 1.0,
                          tabs: [
                            Tab(
                              text: FFLocalizations.of(context).getText(
                                'p7qz28e5' /* Running */,
                              ),
                            ),
                            Tab(
                              text: FFLocalizations.of(context).getText(
                                '51k31no0' /* Upcoming */,
                              ),
                            ),
                            Tab(
                              text: FFLocalizations.of(context).getText(
                                '1rpcimuq' /* Past */,
                              ),
                            ),
                          ],
                          controller: _model.tabBarController,
                          onTap: (i) async {
                            [() async {}, () async {}, () async {}][i]();
                          },
                        ),
                      ),
                      Expanded(
                        child: TabBarView(
                          controller: _model.tabBarController,
                          children: [
                            Padding(
                              padding: EdgeInsetsDirectional.fromSTEB(
                                  15.0, 0.0, 15.0, 0.0),
                              child: SingleChildScrollView(
                                child: Column(
                                  mainAxisSize: MainAxisSize.max,
                                  children: [
                                    Padding(
                                      padding: EdgeInsetsDirectional.fromSTEB(
                                          0.0, 20.0, 0.0, 0.0),
                                      child: Builder(
                                        builder: (context) {
                                          final uniqueEvent =
                                              _model.runningEvents.toList();

                                          return ListView.separated(
                                            padding: EdgeInsets.fromLTRB(
                                              0,
                                              0,
                                              0,
                                              80.0,
                                            ),
                                            primary: false,
                                            shrinkWrap: true,
                                            scrollDirection: Axis.vertical,
                                            itemCount: uniqueEvent.length,
                                            separatorBuilder: (_, __) =>
                                                SizedBox(height: 10.0),
                                            itemBuilder:
                                                (context, uniqueEventIndex) {
                                              final uniqueEventItem =
                                                  uniqueEvent[uniqueEventIndex];
                                              return Align(
                                                alignment: AlignmentDirectional(
                                                    0.0, 1.0),
                                                child: Container(
                                                  width: double.infinity,
                                                  height: 210.0,
                                                  decoration: BoxDecoration(
                                                    image: DecorationImage(
                                                      fit: BoxFit.cover,
                                                      alignment:
                                                          AlignmentDirectional(
                                                              0.0, 0.0),
                                                      image: Image.asset(
                                                        'assets/images/Nouveau_projet.webp',
                                                      ).image,
                                                    ),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            25.0),
                                                  ),
                                                  alignment:
                                                      AlignmentDirectional(
                                                          0.0, 1.0),
                                                  child: Align(
                                                    alignment:
                                                        AlignmentDirectional(
                                                            0.0, 1.0),
                                                    child: Padding(
                                                      padding:
                                                          EdgeInsetsDirectional
                                                              .fromSTEB(
                                                                  0.0,
                                                                  0.0,
                                                                  0.0,
                                                                  20.0),
                                                      child: Container(
                                                        width:
                                                            MediaQuery.sizeOf(
                                                                        context)
                                                                    .width *
                                                                0.8,
                                                        height: 45.0,
                                                        decoration:
                                                            BoxDecoration(
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                      25.0),
                                                          shape: BoxShape
                                                              .rectangle,
                                                        ),
                                                        child: Align(
                                                          alignment:
                                                              AlignmentDirectional(
                                                                  0.0, 0.0),
                                                          child: ClipRRect(
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        24.0),
                                                            child:
                                                                BackdropFilter(
                                                              filter:
                                                                  ImageFilter
                                                                      .blur(
                                                                sigmaX: 2.0,
                                                                sigmaY: 2.0,
                                                              ),
                                                              child: Align(
                                                                alignment:
                                                                    AlignmentDirectional(
                                                                        0.0,
                                                                        1.0),
                                                                child:
                                                                    Container(
                                                                  width: MediaQuery.sizeOf(
                                                                              context)
                                                                          .width *
                                                                      0.8,
                                                                  height: double
                                                                      .infinity,
                                                                  decoration:
                                                                      BoxDecoration(
                                                                    color: Color(
                                                                        0x84050A11),
                                                                    borderRadius:
                                                                        BorderRadius.circular(
                                                                            25.0),
                                                                    shape: BoxShape
                                                                        .rectangle,
                                                                  ),
                                                                  child: Row(
                                                                    mainAxisSize:
                                                                        MainAxisSize
                                                                            .max,
                                                                    mainAxisAlignment:
                                                                        MainAxisAlignment
                                                                            .spaceBetween,
                                                                    children: [
                                                                      Padding(
                                                                        padding: EdgeInsetsDirectional.fromSTEB(
                                                                            15.0,
                                                                            9.0,
                                                                            0.0,
                                                                            9.0),
                                                                        child:
                                                                            Column(
                                                                          mainAxisSize:
                                                                              MainAxisSize.max,
                                                                          mainAxisAlignment:
                                                                              MainAxisAlignment.spaceBetween,
                                                                          crossAxisAlignment:
                                                                              CrossAxisAlignment.start,
                                                                          children: [
                                                                            Text(
                                                                              dateTimeFormat(
                                                                                "MMMMEEEEd",
                                                                                DateTime.fromMillisecondsSinceEpoch(getJsonField(
                                                                                  uniqueEventItem,
                                                                                  r'''$.begin_at''',
                                                                                )),
                                                                                locale: FFLocalizations.of(context).languageCode,
                                                                              ),
                                                                              style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                    font: GoogleFonts.dmSans(
                                                                                      fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                      fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                    ),
                                                                                    color: Color(0xFFA2A2A2),
                                                                                    fontSize: 8.0,
                                                                                    letterSpacing: 0.0,
                                                                                    fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                    fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                  ),
                                                                            ),
                                                                            Text(
                                                                              getJsonField(
                                                                                uniqueEventItem,
                                                                                r'''$.league.name''',
                                                                              ).toString(),
                                                                              style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                    font: GoogleFonts.inter(
                                                                                      fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                      fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                    ),
                                                                                    color: Colors.white,
                                                                                    fontSize: 9.0,
                                                                                    letterSpacing: 0.0,
                                                                                    fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                    fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                  ),
                                                                            ),
                                                                          ],
                                                                        ),
                                                                      ),
                                                                      Padding(
                                                                        padding: EdgeInsetsDirectional.fromSTEB(
                                                                            0.0,
                                                                            0.0,
                                                                            3.0,
                                                                            0.0),
                                                                        child:
                                                                            Container(
                                                                          width:
                                                                              40.0,
                                                                          height:
                                                                              40.0,
                                                                          decoration:
                                                                              BoxDecoration(
                                                                            color:
                                                                                Color(0xA02E3641),
                                                                            shape:
                                                                                BoxShape.circle,
                                                                          ),
                                                                          child:
                                                                              FlutterFlowIconButton(
                                                                            borderRadius:
                                                                                8.0,
                                                                            buttonSize:
                                                                                40.0,
                                                                            icon:
                                                                                Icon(
                                                                              Icons.arrow_outward_rounded,
                                                                              color: FlutterFlowTheme.of(context).info,
                                                                              size: 15.0,
                                                                            ),
                                                                            onPressed:
                                                                                () {
                                                                              print('IconButton pressed ...');
                                                                            },
                                                                          ),
                                                                        ),
                                                                      ),
                                                                    ],
                                                                  ),
                                                                ),
                                                              ),
                                                            ),
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              );
                                            },
                                          );
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Padding(
                              padding: EdgeInsetsDirectional.fromSTEB(
                                  15.0, 0.0, 15.0, 0.0),
                              child: SingleChildScrollView(
                                child: Column(
                                  mainAxisSize: MainAxisSize.max,
                                  children: [
                                    Padding(
                                      padding: EdgeInsetsDirectional.fromSTEB(
                                          0.0, 20.0, 0.0, 0.0),
                                      child: Builder(
                                        builder: (context) {
                                          final uniqueEvent =
                                              _model.upcomingEvents.toList();

                                          return ListView.separated(
                                            padding: EdgeInsets.fromLTRB(
                                              0,
                                              0,
                                              0,
                                              80.0,
                                            ),
                                            primary: false,
                                            shrinkWrap: true,
                                            scrollDirection: Axis.vertical,
                                            itemCount: uniqueEvent.length,
                                            separatorBuilder: (_, __) =>
                                                SizedBox(height: 10.0),
                                            itemBuilder:
                                                (context, uniqueEventIndex) {
                                              final uniqueEventItem =
                                                  uniqueEvent[uniqueEventIndex];
                                              return Align(
                                                alignment: AlignmentDirectional(
                                                    0.0, 1.0),
                                                child: InkWell(
                                                  splashColor:
                                                      Colors.transparent,
                                                  focusColor:
                                                      Colors.transparent,
                                                  hoverColor:
                                                      Colors.transparent,
                                                  highlightColor:
                                                      Colors.transparent,
                                                  onTap: () async {
                                                    context.pushNamed(
                                                      UniqueEventWidget
                                                          .routeName,
                                                      queryParameters: {
                                                        'event': serializeParam(
                                                          getJsonField(
                                                            uniqueEventItem,
                                                            r'''$''',
                                                          ),
                                                          ParamType.JSON,
                                                        ),
                                                      }.withoutNulls,
                                                    );
                                                  },
                                                  child: Container(
                                                    width: double.infinity,
                                                    height: 210.0,
                                                    decoration: BoxDecoration(
                                                      image: DecorationImage(
                                                        fit: BoxFit.cover,
                                                        alignment:
                                                            AlignmentDirectional(
                                                                0.0, 0.0),
                                                        image: Image.asset(
                                                          'assets/images/Nouveau_projet.webp',
                                                        ).image,
                                                      ),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              25.0),
                                                    ),
                                                    alignment:
                                                        AlignmentDirectional(
                                                            0.0, 1.0),
                                                    child: Align(
                                                      alignment:
                                                          AlignmentDirectional(
                                                              0.0, 1.0),
                                                      child: Padding(
                                                        padding:
                                                            EdgeInsetsDirectional
                                                                .fromSTEB(
                                                                    0.0,
                                                                    0.0,
                                                                    0.0,
                                                                    20.0),
                                                        child: Container(
                                                          width:
                                                              MediaQuery.sizeOf(
                                                                          context)
                                                                      .width *
                                                                  0.8,
                                                          height: 45.0,
                                                          decoration:
                                                              BoxDecoration(
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        25.0),
                                                            shape: BoxShape
                                                                .rectangle,
                                                          ),
                                                          child: Align(
                                                            alignment:
                                                                AlignmentDirectional(
                                                                    0.0, 0.0),
                                                            child: ClipRRect(
                                                              borderRadius:
                                                                  BorderRadius
                                                                      .circular(
                                                                          24.0),
                                                              child:
                                                                  BackdropFilter(
                                                                filter:
                                                                    ImageFilter
                                                                        .blur(
                                                                  sigmaX: 2.0,
                                                                  sigmaY: 2.0,
                                                                ),
                                                                child: Align(
                                                                  alignment:
                                                                      AlignmentDirectional(
                                                                          0.0,
                                                                          1.0),
                                                                  child:
                                                                      Container(
                                                                    width: MediaQuery.sizeOf(context)
                                                                            .width *
                                                                        0.8,
                                                                    height: double
                                                                        .infinity,
                                                                    decoration:
                                                                        BoxDecoration(
                                                                      color: Color(
                                                                          0x84050A11),
                                                                      borderRadius:
                                                                          BorderRadius.circular(
                                                                              25.0),
                                                                      shape: BoxShape
                                                                          .rectangle,
                                                                    ),
                                                                    child: Row(
                                                                      mainAxisSize:
                                                                          MainAxisSize
                                                                              .max,
                                                                      mainAxisAlignment:
                                                                          MainAxisAlignment
                                                                              .spaceBetween,
                                                                      children: [
                                                                        Padding(
                                                                          padding: EdgeInsetsDirectional.fromSTEB(
                                                                              15.0,
                                                                              9.0,
                                                                              0.0,
                                                                              9.0),
                                                                          child:
                                                                              Column(
                                                                            mainAxisSize:
                                                                                MainAxisSize.max,
                                                                            mainAxisAlignment:
                                                                                MainAxisAlignment.spaceBetween,
                                                                            crossAxisAlignment:
                                                                                CrossAxisAlignment.start,
                                                                            children: [
                                                                              Text(
                                                                                dateTimeFormat(
                                                                                  "MMMMEEEEd",
                                                                                  DateTime.fromMillisecondsSinceEpoch(getJsonField(
                                                                                    uniqueEventItem,
                                                                                    r'''$.begin_at''',
                                                                                  )),
                                                                                  locale: FFLocalizations.of(context).languageCode,
                                                                                ),
                                                                                style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                      font: GoogleFonts.dmSans(
                                                                                        fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                        fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                      ),
                                                                                      color: Color(0xFFA2A2A2),
                                                                                      fontSize: 8.0,
                                                                                      letterSpacing: 0.0,
                                                                                      fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                      fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                    ),
                                                                              ),
                                                                              Text(
                                                                                getJsonField(
                                                                                  uniqueEventItem,
                                                                                  r'''$.league.name''',
                                                                                ).toString(),
                                                                                style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                      font: GoogleFonts.inter(
                                                                                        fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                        fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                      ),
                                                                                      color: Colors.white,
                                                                                      fontSize: 9.0,
                                                                                      letterSpacing: 0.0,
                                                                                      fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                      fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                    ),
                                                                              ),
                                                                            ],
                                                                          ),
                                                                        ),
                                                                        Padding(
                                                                          padding: EdgeInsetsDirectional.fromSTEB(
                                                                              0.0,
                                                                              0.0,
                                                                              3.0,
                                                                              0.0),
                                                                          child:
                                                                              Container(
                                                                            width:
                                                                                40.0,
                                                                            height:
                                                                                40.0,
                                                                            decoration:
                                                                                BoxDecoration(
                                                                              color: Color(0xA02E3641),
                                                                              shape: BoxShape.circle,
                                                                            ),
                                                                            child:
                                                                                FlutterFlowIconButton(
                                                                              borderRadius: 8.0,
                                                                              buttonSize: 40.0,
                                                                              icon: Icon(
                                                                                Icons.arrow_outward_rounded,
                                                                                color: FlutterFlowTheme.of(context).info,
                                                                                size: 15.0,
                                                                              ),
                                                                              onPressed: () {
                                                                                print('IconButton pressed ...');
                                                                              },
                                                                            ),
                                                                          ),
                                                                        ),
                                                                      ],
                                                                    ),
                                                                  ),
                                                                ),
                                                              ),
                                                            ),
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              );
                                            },
                                          );
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            Padding(
                              padding: EdgeInsetsDirectional.fromSTEB(
                                  15.0, 0.0, 15.0, 0.0),
                              child: SingleChildScrollView(
                                child: Column(
                                  mainAxisSize: MainAxisSize.max,
                                  children: [
                                    Padding(
                                      padding: EdgeInsetsDirectional.fromSTEB(
                                          0.0, 20.0, 0.0, 0.0),
                                      child: Builder(
                                        builder: (context) {
                                          final uniqueEvent =
                                              _model.pastEvents.toList();

                                          return ListView.separated(
                                            padding: EdgeInsets.fromLTRB(
                                              0,
                                              0,
                                              0,
                                              80.0,
                                            ),
                                            primary: false,
                                            shrinkWrap: true,
                                            scrollDirection: Axis.vertical,
                                            itemCount: uniqueEvent.length,
                                            separatorBuilder: (_, __) =>
                                                SizedBox(height: 10.0),
                                            itemBuilder:
                                                (context, uniqueEventIndex) {
                                              final uniqueEventItem =
                                                  uniqueEvent[uniqueEventIndex];
                                              return Align(
                                                alignment: AlignmentDirectional(
                                                    0.0, 1.0),
                                                child: InkWell(
                                                  splashColor:
                                                      Colors.transparent,
                                                  focusColor:
                                                      Colors.transparent,
                                                  hoverColor:
                                                      Colors.transparent,
                                                  highlightColor:
                                                      Colors.transparent,
                                                  onTap: () async {
                                                    context.pushNamed(
                                                      UniqueEventWidget
                                                          .routeName,
                                                      queryParameters: {
                                                        'event': serializeParam(
                                                          getJsonField(
                                                            uniqueEventItem,
                                                            r'''$''',
                                                          ),
                                                          ParamType.JSON,
                                                        ),
                                                      }.withoutNulls,
                                                    );
                                                  },
                                                  child: Container(
                                                    width: double.infinity,
                                                    height: 210.0,
                                                    decoration: BoxDecoration(
                                                      image: DecorationImage(
                                                        fit: BoxFit.cover,
                                                        alignment:
                                                            AlignmentDirectional(
                                                                0.0, 0.0),
                                                        image: Image.asset(
                                                          'assets/images/Nouveau_projet.webp',
                                                        ).image,
                                                      ),
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              25.0),
                                                    ),
                                                    alignment:
                                                        AlignmentDirectional(
                                                            0.0, 1.0),
                                                    child: Align(
                                                      alignment:
                                                          AlignmentDirectional(
                                                              0.0, 1.0),
                                                      child: Padding(
                                                        padding:
                                                            EdgeInsetsDirectional
                                                                .fromSTEB(
                                                                    0.0,
                                                                    0.0,
                                                                    0.0,
                                                                    20.0),
                                                        child: Container(
                                                          width:
                                                              MediaQuery.sizeOf(
                                                                          context)
                                                                      .width *
                                                                  0.8,
                                                          height: 45.0,
                                                          decoration:
                                                              BoxDecoration(
                                                            borderRadius:
                                                                BorderRadius
                                                                    .circular(
                                                                        25.0),
                                                            shape: BoxShape
                                                                .rectangle,
                                                          ),
                                                          child: Align(
                                                            alignment:
                                                                AlignmentDirectional(
                                                                    0.0, 0.0),
                                                            child: ClipRRect(
                                                              borderRadius:
                                                                  BorderRadius
                                                                      .circular(
                                                                          24.0),
                                                              child:
                                                                  BackdropFilter(
                                                                filter:
                                                                    ImageFilter
                                                                        .blur(
                                                                  sigmaX: 2.0,
                                                                  sigmaY: 2.0,
                                                                ),
                                                                child: Align(
                                                                  alignment:
                                                                      AlignmentDirectional(
                                                                          0.0,
                                                                          1.0),
                                                                  child:
                                                                      Container(
                                                                    width: MediaQuery.sizeOf(context)
                                                                            .width *
                                                                        0.8,
                                                                    height: double
                                                                        .infinity,
                                                                    decoration:
                                                                        BoxDecoration(
                                                                      color: Color(
                                                                          0x84050A11),
                                                                      borderRadius:
                                                                          BorderRadius.circular(
                                                                              25.0),
                                                                      shape: BoxShape
                                                                          .rectangle,
                                                                    ),
                                                                    child: Row(
                                                                      mainAxisSize:
                                                                          MainAxisSize
                                                                              .max,
                                                                      mainAxisAlignment:
                                                                          MainAxisAlignment
                                                                              .spaceBetween,
                                                                      children: [
                                                                        Padding(
                                                                          padding: EdgeInsetsDirectional.fromSTEB(
                                                                              15.0,
                                                                              9.0,
                                                                              0.0,
                                                                              9.0),
                                                                          child:
                                                                              Column(
                                                                            mainAxisSize:
                                                                                MainAxisSize.max,
                                                                            mainAxisAlignment:
                                                                                MainAxisAlignment.spaceBetween,
                                                                            crossAxisAlignment:
                                                                                CrossAxisAlignment.start,
                                                                            children: [
                                                                              Text(
                                                                                dateTimeFormat(
                                                                                  "MMMMEEEEd",
                                                                                  DateTime.fromMillisecondsSinceEpoch(getJsonField(
                                                                                    uniqueEventItem,
                                                                                    r'''$.begin_at''',
                                                                                  )),
                                                                                  locale: FFLocalizations.of(context).languageCode,
                                                                                ),
                                                                                style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                      font: GoogleFonts.dmSans(
                                                                                        fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                        fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                      ),
                                                                                      color: Color(0xFFA2A2A2),
                                                                                      fontSize: 8.0,
                                                                                      letterSpacing: 0.0,
                                                                                      fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                      fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                    ),
                                                                              ),
                                                                              Text(
                                                                                getJsonField(
                                                                                  uniqueEventItem,
                                                                                  r'''$.league.name''',
                                                                                ).toString(),
                                                                                style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                      font: GoogleFonts.inter(
                                                                                        fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                        fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                      ),
                                                                                      color: Colors.white,
                                                                                      fontSize: 9.0,
                                                                                      letterSpacing: 0.0,
                                                                                      fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                      fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                    ),
                                                                              ),
                                                                            ],
                                                                          ),
                                                                        ),
                                                                        Padding(
                                                                          padding: EdgeInsetsDirectional.fromSTEB(
                                                                              0.0,
                                                                              0.0,
                                                                              3.0,
                                                                              0.0),
                                                                          child:
                                                                              Container(
                                                                            width:
                                                                                40.0,
                                                                            height:
                                                                                40.0,
                                                                            decoration:
                                                                                BoxDecoration(
                                                                              color: Color(0xA02E3641),
                                                                              shape: BoxShape.circle,
                                                                            ),
                                                                            child:
                                                                                FlutterFlowIconButton(
                                                                              borderRadius: 8.0,
                                                                              buttonSize: 40.0,
                                                                              icon: Icon(
                                                                                Icons.arrow_outward_rounded,
                                                                                color: FlutterFlowTheme.of(context).info,
                                                                                size: 15.0,
                                                                              ),
                                                                              onPressed: () {
                                                                                print('IconButton pressed ...');
                                                                              },
                                                                            ),
                                                                          ),
                                                                        ),
                                                                      ],
                                                                    ),
                                                                  ),
                                                                ),
                                                              ),
                                                            ),
                                                          ),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              );
                                            },
                                          );
                                        },
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding:
                      EdgeInsetsDirectional.fromSTEB(15.0, 40.0, 15.0, 20.0),
                  child: wrapWithModel(
                    model: _model.topBarMobileHomeModel,
                    updateCallback: () => safeSetState(() {}),
                    child: TopBarMobileHomeWidget(),
                  ),
                ),
                Align(
                  alignment: AlignmentDirectional(0.0, 1.0),
                  child: wrapWithModel(
                    model: _model.navBarHomeModel,
                    updateCallback: () => safeSetState(() {}),
                    child: NavBarHomeWidget(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
