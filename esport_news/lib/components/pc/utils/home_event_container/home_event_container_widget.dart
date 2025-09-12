import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/index.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'home_event_container_model.dart';
export 'home_event_container_model.dart';

class HomeEventContainerWidget extends StatefulWidget {
  const HomeEventContainerWidget({super.key});

  @override
  State<HomeEventContainerWidget> createState() =>
      _HomeEventContainerWidgetState();
}

class _HomeEventContainerWidgetState extends State<HomeEventContainerWidget>
    with TickerProviderStateMixin {
  late HomeEventContainerModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => HomeEventContainerModel());

    // On component load action.
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
          safeSetState(() {});
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
          safeSetState(() {});
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
          safeSetState(() {});
        }),
      ]);
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
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    context.watch<FFAppState>();

    return Container(
      width: 340.0,
      decoration: BoxDecoration(
        color: FlutterFlowTheme.of(context).backgroundHome,
        borderRadius: BorderRadius.circular(10.0),
      ),
      child: Padding(
        padding: EdgeInsetsDirectional.fromSTEB(0.0, 10.0, 0.0, 0.0),
        child: Column(
          children: [
            Align(
              alignment: Alignment(0.0, 0),
              child: TabBar(
                labelColor: FlutterFlowTheme.of(context).primaryText,
                unselectedLabelColor:
                    FlutterFlowTheme.of(context).secondaryText,
                labelStyle: FlutterFlowTheme.of(context).titleMedium.override(
                      font: GoogleFonts.dmSans(
                        fontWeight: FontWeight.w600,
                        fontStyle:
                            FlutterFlowTheme.of(context).titleMedium.fontStyle,
                      ),
                      fontSize: 14.0,
                      letterSpacing: 0.0,
                      fontWeight: FontWeight.w600,
                      fontStyle:
                          FlutterFlowTheme.of(context).titleMedium.fontStyle,
                    ),
                unselectedLabelStyle: TextStyle(),
                indicatorColor: FlutterFlowTheme.of(context).secondary,
                indicatorWeight: 1.0,
                tabs: [
                  Tab(
                    text: FFLocalizations.of(context).getText(
                      'llei7wb7' /* Live */,
                    ),
                  ),
                  Tab(
                    text: FFLocalizations.of(context).getText(
                      'dtcudgl6' /* Upcoming */,
                    ),
                  ),
                  Tab(
                    text: FFLocalizations.of(context).getText(
                      'zzvdxsyx' /* Past */,
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
                  SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.max,
                      children: [
                        Builder(
                          builder: (context) {
                            final event = _model.runningEvents.toList();

                            return ListView.builder(
                              padding: EdgeInsets.zero,
                              shrinkWrap: true,
                              scrollDirection: Axis.vertical,
                              itemCount: event.length,
                              itemBuilder: (context, eventIndex) {
                                final eventItem = event[eventIndex];
                                return Align(
                                  alignment: AlignmentDirectional(0.0, 1.0),
                                  child: InkWell(
                                    splashColor: Colors.transparent,
                                    focusColor: Colors.transparent,
                                    hoverColor: Colors.transparent,
                                    highlightColor: Colors.transparent,
                                    onTap: () async {
                                      context.pushNamed(
                                        UniqueEventWidget.routeName,
                                        queryParameters: {
                                          'event': serializeParam(
                                            getJsonField(
                                              eventItem,
                                              r'''$''',
                                            ),
                                            ParamType.JSON,
                                          ),
                                          'outputGetAllEvent': serializeParam(
                                            FFAppState().varComingEvents,
                                            ParamType.JSON,
                                            isList: true,
                                          ),
                                        }.withoutNulls,
                                      );
                                    },
                                    child: Container(
                                      width: double.infinity,
                                      height: 100.0,
                                      decoration: BoxDecoration(
                                        image: DecorationImage(
                                          fit: BoxFit.cover,
                                          alignment:
                                              AlignmentDirectional(0.0, 0.0),
                                          image: Image.asset(
                                            'assets/images/esports-hero.jpg',
                                          ).image,
                                        ),
                                        borderRadius:
                                            BorderRadius.circular(0.0),
                                      ),
                                      alignment: AlignmentDirectional(0.0, 1.0),
                                      child: Stack(
                                        children: [
                                          Container(
                                            width: double.infinity,
                                            height: 100.0,
                                            decoration: BoxDecoration(
                                              gradient: LinearGradient(
                                                colors: [
                                                  Color(0x00050A11),
                                                  FlutterFlowTheme.of(context)
                                                      .backgroundHome
                                                ],
                                                stops: [0.0, 1.0],
                                                begin: AlignmentDirectional(
                                                    1.0, 0.0),
                                                end: AlignmentDirectional(
                                                    -1.0, 0),
                                              ),
                                            ),
                                            child: Padding(
                                              padding: EdgeInsetsDirectional
                                                  .fromSTEB(
                                                      10.0, 0.0, 10.0, 0.0),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.max,
                                                mainAxisAlignment:
                                                    MainAxisAlignment
                                                        .spaceBetween,
                                                children: [
                                                  Row(
                                                    mainAxisSize:
                                                        MainAxisSize.max,
                                                    children: [
                                                      Container(
                                                        width: 50.0,
                                                        height: 50.0,
                                                        decoration:
                                                            BoxDecoration(
                                                          color: Colors.white,
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                      50.0),
                                                        ),
                                                        alignment:
                                                            AlignmentDirectional(
                                                                0.0, 0.0),
                                                        child: ClipRRect(
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                      8.0),
                                                          child: Image.network(
                                                            getJsonField(
                                                              eventItem,
                                                              r'''$.league.image_url''',
                                                            ).toString(),
                                                            width: 35.0,
                                                            height: 35.0,
                                                            fit: BoxFit.contain,
                                                          ),
                                                        ),
                                                      ),
                                                      Padding(
                                                        padding:
                                                            EdgeInsetsDirectional
                                                                .fromSTEB(
                                                                    15.0,
                                                                    26.0,
                                                                    0.0,
                                                                    26.0),
                                                        child: Column(
                                                          mainAxisSize:
                                                              MainAxisSize.max,
                                                          mainAxisAlignment:
                                                              MainAxisAlignment
                                                                  .spaceBetween,
                                                          crossAxisAlignment:
                                                              CrossAxisAlignment
                                                                  .start,
                                                          children: [
                                                            Text(
                                                              getJsonField(
                                                                eventItem,
                                                                r'''$.league.name''',
                                                              ).toString(),
                                                              style: FlutterFlowTheme
                                                                      .of(context)
                                                                  .bodyMedium
                                                                  .override(
                                                                    font: GoogleFonts
                                                                        .inter(
                                                                      fontWeight:
                                                                          FontWeight
                                                                              .w600,
                                                                      fontStyle: FlutterFlowTheme.of(
                                                                              context)
                                                                          .bodyMedium
                                                                          .fontStyle,
                                                                    ),
                                                                    fontSize:
                                                                        14.0,
                                                                    letterSpacing:
                                                                        0.0,
                                                                    fontWeight:
                                                                        FontWeight
                                                                            .w600,
                                                                    fontStyle: FlutterFlowTheme.of(
                                                                            context)
                                                                        .bodyMedium
                                                                        .fontStyle,
                                                                  ),
                                                            ),
                                                            Text(
                                                              '${dateTimeFormat(
                                                                "d/M/y",
                                                                DateTime.fromMillisecondsSinceEpoch(
                                                                    getJsonField(
                                                                  eventItem,
                                                                  r'''$.begin_at''',
                                                                )),
                                                                locale: FFLocalizations.of(
                                                                        context)
                                                                    .languageCode,
                                                              )} - ${dateTimeFormat(
                                                                "d/M/y",
                                                                DateTime.fromMillisecondsSinceEpoch(
                                                                    getJsonField(
                                                                  eventItem,
                                                                  r'''$.end_at''',
                                                                )),
                                                                locale: FFLocalizations.of(
                                                                        context)
                                                                    .languageCode,
                                                              )}',
                                                              style: FlutterFlowTheme
                                                                      .of(context)
                                                                  .bodyMedium
                                                                  .override(
                                                                    font: GoogleFonts
                                                                        .inter(
                                                                      fontWeight: FlutterFlowTheme.of(
                                                                              context)
                                                                          .bodyMedium
                                                                          .fontWeight,
                                                                      fontStyle: FlutterFlowTheme.of(
                                                                              context)
                                                                          .bodyMedium
                                                                          .fontStyle,
                                                                    ),
                                                                    fontSize:
                                                                        12.0,
                                                                    letterSpacing:
                                                                        0.0,
                                                                    fontWeight: FlutterFlowTheme.of(
                                                                            context)
                                                                        .bodyMedium
                                                                        .fontWeight,
                                                                    fontStyle: FlutterFlowTheme.of(
                                                                            context)
                                                                        .bodyMedium
                                                                        .fontStyle,
                                                                  ),
                                                            ),
                                                          ],
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                  Container(
                                                    height: 30.0,
                                                    decoration: BoxDecoration(
                                                      color: Colors.white,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              10.0),
                                                    ),
                                                    child: Align(
                                                      alignment:
                                                          AlignmentDirectional(
                                                              0.0, 0.0),
                                                      child: Padding(
                                                        padding:
                                                            EdgeInsetsDirectional
                                                                .fromSTEB(
                                                                    10.0,
                                                                    0.0,
                                                                    10.0,
                                                                    0.0),
                                                        child: Text(
                                                          valueOrDefault<
                                                              String>(
                                                            getJsonField(
                                                              eventItem,
                                                              r'''$.videogame.name''',
                                                            )?.toString(),
                                                            'Counter Strike',
                                                          ),
                                                          style: FlutterFlowTheme
                                                                  .of(context)
                                                              .bodyMedium
                                                              .override(
                                                                font:
                                                                    GoogleFonts
                                                                        .inter(
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .w600,
                                                                  fontStyle: FlutterFlowTheme.of(
                                                                          context)
                                                                      .bodyMedium
                                                                      .fontStyle,
                                                                ),
                                                                color: Color(
                                                                    0xFF050A11),
                                                                fontSize: 11.0,
                                                                letterSpacing:
                                                                    0.0,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w600,
                                                                fontStyle: FlutterFlowTheme.of(
                                                                        context)
                                                                    .bodyMedium
                                                                    .fontStyle,
                                                              ),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.max,
                      children: [
                        Builder(
                          builder: (context) {
                            final event = _model.upcomingEvents.toList();

                            return ListView.builder(
                              padding: EdgeInsets.zero,
                              shrinkWrap: true,
                              scrollDirection: Axis.vertical,
                              itemCount: event.length,
                              itemBuilder: (context, eventIndex) {
                                final eventItem = event[eventIndex];
                                return Align(
                                  alignment: AlignmentDirectional(0.0, 1.0),
                                  child: InkWell(
                                    splashColor: Colors.transparent,
                                    focusColor: Colors.transparent,
                                    hoverColor: Colors.transparent,
                                    highlightColor: Colors.transparent,
                                    onTap: () async {
                                      context.pushNamed(
                                        UniqueEventWidget.routeName,
                                        queryParameters: {
                                          'event': serializeParam(
                                            getJsonField(
                                              eventItem,
                                              r'''$''',
                                            ),
                                            ParamType.JSON,
                                          ),
                                          'outputGetAllEvent': serializeParam(
                                            FFAppState().varComingEvents,
                                            ParamType.JSON,
                                            isList: true,
                                          ),
                                        }.withoutNulls,
                                      );
                                    },
                                    child: Container(
                                      width: double.infinity,
                                      height: 100.0,
                                      decoration: BoxDecoration(
                                        image: DecorationImage(
                                          fit: BoxFit.cover,
                                          alignment:
                                              AlignmentDirectional(0.0, 0.0),
                                          image: Image.asset(
                                            'assets/images/esports-hero.jpg',
                                          ).image,
                                        ),
                                        borderRadius:
                                            BorderRadius.circular(0.0),
                                      ),
                                      alignment: AlignmentDirectional(0.0, 1.0),
                                      child: Stack(
                                        children: [
                                          Container(
                                            width: double.infinity,
                                            height: 100.0,
                                            decoration: BoxDecoration(
                                              gradient: LinearGradient(
                                                colors: [
                                                  Color(0x00050A11),
                                                  FlutterFlowTheme.of(context)
                                                      .backgroundHome
                                                ],
                                                stops: [0.0, 1.0],
                                                begin: AlignmentDirectional(
                                                    1.0, 0.0),
                                                end: AlignmentDirectional(
                                                    -1.0, 0),
                                              ),
                                            ),
                                            child: Padding(
                                              padding: EdgeInsetsDirectional
                                                  .fromSTEB(
                                                      10.0, 0.0, 10.0, 0.0),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.max,
                                                mainAxisAlignment:
                                                    MainAxisAlignment
                                                        .spaceBetween,
                                                children: [
                                                  Row(
                                                    mainAxisSize:
                                                        MainAxisSize.max,
                                                    children: [
                                                      Container(
                                                        width: 50.0,
                                                        height: 50.0,
                                                        decoration:
                                                            BoxDecoration(
                                                          color: Colors.white,
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                      50.0),
                                                        ),
                                                        alignment:
                                                            AlignmentDirectional(
                                                                0.0, 0.0),
                                                        child: ClipRRect(
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                      8.0),
                                                          child: Image.network(
                                                            getJsonField(
                                                              eventItem,
                                                              r'''$.league.image_url''',
                                                            ).toString(),
                                                            width: 35.0,
                                                            height: 35.0,
                                                            fit: BoxFit.contain,
                                                          ),
                                                        ),
                                                      ),
                                                      Padding(
                                                        padding:
                                                            EdgeInsetsDirectional
                                                                .fromSTEB(
                                                                    15.0,
                                                                    26.0,
                                                                    0.0,
                                                                    26.0),
                                                        child: Column(
                                                          mainAxisSize:
                                                              MainAxisSize.max,
                                                          mainAxisAlignment:
                                                              MainAxisAlignment
                                                                  .spaceBetween,
                                                          crossAxisAlignment:
                                                              CrossAxisAlignment
                                                                  .start,
                                                          children: [
                                                            Text(
                                                              getJsonField(
                                                                eventItem,
                                                                r'''$.league.name''',
                                                              ).toString(),
                                                              style: FlutterFlowTheme
                                                                      .of(context)
                                                                  .bodyMedium
                                                                  .override(
                                                                    font: GoogleFonts
                                                                        .inter(
                                                                      fontWeight:
                                                                          FontWeight
                                                                              .w600,
                                                                      fontStyle: FlutterFlowTheme.of(
                                                                              context)
                                                                          .bodyMedium
                                                                          .fontStyle,
                                                                    ),
                                                                    fontSize:
                                                                        14.0,
                                                                    letterSpacing:
                                                                        0.0,
                                                                    fontWeight:
                                                                        FontWeight
                                                                            .w600,
                                                                    fontStyle: FlutterFlowTheme.of(
                                                                            context)
                                                                        .bodyMedium
                                                                        .fontStyle,
                                                                  ),
                                                            ),
                                                            Text(
                                                              '${dateTimeFormat(
                                                                "d/M/y",
                                                                DateTime.fromMillisecondsSinceEpoch(
                                                                    getJsonField(
                                                                  eventItem,
                                                                  r'''$.begin_at''',
                                                                )),
                                                                locale: FFLocalizations.of(
                                                                        context)
                                                                    .languageCode,
                                                              )} - ${dateTimeFormat(
                                                                "d/M/y",
                                                                DateTime.fromMillisecondsSinceEpoch(
                                                                    getJsonField(
                                                                  eventItem,
                                                                  r'''$.end_at''',
                                                                )),
                                                                locale: FFLocalizations.of(
                                                                        context)
                                                                    .languageCode,
                                                              )}',
                                                              style: FlutterFlowTheme
                                                                      .of(context)
                                                                  .bodyMedium
                                                                  .override(
                                                                    font: GoogleFonts
                                                                        .inter(
                                                                      fontWeight: FlutterFlowTheme.of(
                                                                              context)
                                                                          .bodyMedium
                                                                          .fontWeight,
                                                                      fontStyle: FlutterFlowTheme.of(
                                                                              context)
                                                                          .bodyMedium
                                                                          .fontStyle,
                                                                    ),
                                                                    fontSize:
                                                                        12.0,
                                                                    letterSpacing:
                                                                        0.0,
                                                                    fontWeight: FlutterFlowTheme.of(
                                                                            context)
                                                                        .bodyMedium
                                                                        .fontWeight,
                                                                    fontStyle: FlutterFlowTheme.of(
                                                                            context)
                                                                        .bodyMedium
                                                                        .fontStyle,
                                                                  ),
                                                            ),
                                                          ],
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                  Container(
                                                    height: 30.0,
                                                    decoration: BoxDecoration(
                                                      color: Colors.white,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              10.0),
                                                    ),
                                                    child: Align(
                                                      alignment:
                                                          AlignmentDirectional(
                                                              0.0, 0.0),
                                                      child: Padding(
                                                        padding:
                                                            EdgeInsetsDirectional
                                                                .fromSTEB(
                                                                    10.0,
                                                                    0.0,
                                                                    10.0,
                                                                    0.0),
                                                        child: Text(
                                                          valueOrDefault<
                                                              String>(
                                                            getJsonField(
                                                              eventItem,
                                                              r'''$.videogame.name''',
                                                            )?.toString(),
                                                            'Counter Strike',
                                                          ),
                                                          style: FlutterFlowTheme
                                                                  .of(context)
                                                              .bodyMedium
                                                              .override(
                                                                font:
                                                                    GoogleFonts
                                                                        .inter(
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .w600,
                                                                  fontStyle: FlutterFlowTheme.of(
                                                                          context)
                                                                      .bodyMedium
                                                                      .fontStyle,
                                                                ),
                                                                color: Color(
                                                                    0xFF050A11),
                                                                fontSize: 11.0,
                                                                letterSpacing:
                                                                    0.0,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w600,
                                                                fontStyle: FlutterFlowTheme.of(
                                                                        context)
                                                                    .bodyMedium
                                                                    .fontStyle,
                                                              ),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.max,
                      children: [
                        Builder(
                          builder: (context) {
                            final event = _model.pastEvents.toList();

                            return ListView.builder(
                              padding: EdgeInsets.zero,
                              shrinkWrap: true,
                              scrollDirection: Axis.vertical,
                              itemCount: event.length,
                              itemBuilder: (context, eventIndex) {
                                final eventItem = event[eventIndex];
                                return Align(
                                  alignment: AlignmentDirectional(0.0, 1.0),
                                  child: InkWell(
                                    splashColor: Colors.transparent,
                                    focusColor: Colors.transparent,
                                    hoverColor: Colors.transparent,
                                    highlightColor: Colors.transparent,
                                    onTap: () async {
                                      context.pushNamed(
                                        UniqueEventWidget.routeName,
                                        queryParameters: {
                                          'event': serializeParam(
                                            getJsonField(
                                              eventItem,
                                              r'''$''',
                                            ),
                                            ParamType.JSON,
                                          ),
                                          'outputGetAllEvent': serializeParam(
                                            FFAppState().varComingEvents,
                                            ParamType.JSON,
                                            isList: true,
                                          ),
                                        }.withoutNulls,
                                      );
                                    },
                                    child: Container(
                                      width: double.infinity,
                                      height: 100.0,
                                      decoration: BoxDecoration(
                                        image: DecorationImage(
                                          fit: BoxFit.cover,
                                          alignment:
                                              AlignmentDirectional(0.0, 0.0),
                                          image: Image.asset(
                                            'assets/images/esports-hero.jpg',
                                          ).image,
                                        ),
                                        borderRadius:
                                            BorderRadius.circular(0.0),
                                      ),
                                      alignment: AlignmentDirectional(0.0, 1.0),
                                      child: Stack(
                                        children: [
                                          Container(
                                            width: double.infinity,
                                            height: 100.0,
                                            decoration: BoxDecoration(
                                              gradient: LinearGradient(
                                                colors: [
                                                  Color(0x00050A11),
                                                  FlutterFlowTheme.of(context)
                                                      .backgroundHome
                                                ],
                                                stops: [0.0, 1.0],
                                                begin: AlignmentDirectional(
                                                    1.0, 0.0),
                                                end: AlignmentDirectional(
                                                    -1.0, 0),
                                              ),
                                            ),
                                            child: Padding(
                                              padding: EdgeInsetsDirectional
                                                  .fromSTEB(
                                                      10.0, 0.0, 10.0, 0.0),
                                              child: Row(
                                                mainAxisSize: MainAxisSize.max,
                                                mainAxisAlignment:
                                                    MainAxisAlignment
                                                        .spaceBetween,
                                                children: [
                                                  Row(
                                                    mainAxisSize:
                                                        MainAxisSize.max,
                                                    children: [
                                                      Container(
                                                        width: 50.0,
                                                        height: 50.0,
                                                        decoration:
                                                            BoxDecoration(
                                                          color: Colors.white,
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                      50.0),
                                                        ),
                                                        alignment:
                                                            AlignmentDirectional(
                                                                0.0, 0.0),
                                                        child: ClipRRect(
                                                          borderRadius:
                                                              BorderRadius
                                                                  .circular(
                                                                      8.0),
                                                          child: Image.network(
                                                            getJsonField(
                                                              eventItem,
                                                              r'''$.league.image_url''',
                                                            ).toString(),
                                                            width: 35.0,
                                                            height: 35.0,
                                                            fit: BoxFit.contain,
                                                          ),
                                                        ),
                                                      ),
                                                      Padding(
                                                        padding:
                                                            EdgeInsetsDirectional
                                                                .fromSTEB(
                                                                    15.0,
                                                                    26.0,
                                                                    0.0,
                                                                    26.0),
                                                        child: Column(
                                                          mainAxisSize:
                                                              MainAxisSize.max,
                                                          mainAxisAlignment:
                                                              MainAxisAlignment
                                                                  .spaceBetween,
                                                          crossAxisAlignment:
                                                              CrossAxisAlignment
                                                                  .start,
                                                          children: [
                                                            Text(
                                                              getJsonField(
                                                                eventItem,
                                                                r'''$.league.name''',
                                                              ).toString(),
                                                              style: FlutterFlowTheme
                                                                      .of(context)
                                                                  .bodyMedium
                                                                  .override(
                                                                    font: GoogleFonts
                                                                        .inter(
                                                                      fontWeight:
                                                                          FontWeight
                                                                              .w600,
                                                                      fontStyle: FlutterFlowTheme.of(
                                                                              context)
                                                                          .bodyMedium
                                                                          .fontStyle,
                                                                    ),
                                                                    fontSize:
                                                                        14.0,
                                                                    letterSpacing:
                                                                        0.0,
                                                                    fontWeight:
                                                                        FontWeight
                                                                            .w600,
                                                                    fontStyle: FlutterFlowTheme.of(
                                                                            context)
                                                                        .bodyMedium
                                                                        .fontStyle,
                                                                  ),
                                                            ),
                                                            Text(
                                                              '${dateTimeFormat(
                                                                "d/M/y",
                                                                DateTime.fromMillisecondsSinceEpoch(
                                                                    getJsonField(
                                                                  eventItem,
                                                                  r'''$.begin_at''',
                                                                )),
                                                                locale: FFLocalizations.of(
                                                                        context)
                                                                    .languageCode,
                                                              )} - ${dateTimeFormat(
                                                                "d/M/y",
                                                                DateTime.fromMillisecondsSinceEpoch(
                                                                    getJsonField(
                                                                  eventItem,
                                                                  r'''$.end_at''',
                                                                )),
                                                                locale: FFLocalizations.of(
                                                                        context)
                                                                    .languageCode,
                                                              )}',
                                                              style: FlutterFlowTheme
                                                                      .of(context)
                                                                  .bodyMedium
                                                                  .override(
                                                                    font: GoogleFonts
                                                                        .inter(
                                                                      fontWeight: FlutterFlowTheme.of(
                                                                              context)
                                                                          .bodyMedium
                                                                          .fontWeight,
                                                                      fontStyle: FlutterFlowTheme.of(
                                                                              context)
                                                                          .bodyMedium
                                                                          .fontStyle,
                                                                    ),
                                                                    fontSize:
                                                                        12.0,
                                                                    letterSpacing:
                                                                        0.0,
                                                                    fontWeight: FlutterFlowTheme.of(
                                                                            context)
                                                                        .bodyMedium
                                                                        .fontWeight,
                                                                    fontStyle: FlutterFlowTheme.of(
                                                                            context)
                                                                        .bodyMedium
                                                                        .fontStyle,
                                                                  ),
                                                            ),
                                                          ],
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                  Container(
                                                    height: 30.0,
                                                    decoration: BoxDecoration(
                                                      color: Colors.white,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                              10.0),
                                                    ),
                                                    child: Align(
                                                      alignment:
                                                          AlignmentDirectional(
                                                              0.0, 0.0),
                                                      child: Padding(
                                                        padding:
                                                            EdgeInsetsDirectional
                                                                .fromSTEB(
                                                                    10.0,
                                                                    0.0,
                                                                    10.0,
                                                                    0.0),
                                                        child: Text(
                                                          valueOrDefault<
                                                              String>(
                                                            getJsonField(
                                                              eventItem,
                                                              r'''$.videogame.name''',
                                                            )?.toString(),
                                                            'Counter Strike',
                                                          ),
                                                          style: FlutterFlowTheme
                                                                  .of(context)
                                                              .bodyMedium
                                                              .override(
                                                                font:
                                                                    GoogleFonts
                                                                        .inter(
                                                                  fontWeight:
                                                                      FontWeight
                                                                          .w600,
                                                                  fontStyle: FlutterFlowTheme.of(
                                                                          context)
                                                                      .bodyMedium
                                                                      .fontStyle,
                                                                ),
                                                                color: Color(
                                                                    0xFF050A11),
                                                                fontSize: 11.0,
                                                                letterSpacing:
                                                                    0.0,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w600,
                                                                fontStyle: FlutterFlowTheme.of(
                                                                        context)
                                                                    .bodyMedium
                                                                    .fontStyle,
                                                              ),
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              },
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
