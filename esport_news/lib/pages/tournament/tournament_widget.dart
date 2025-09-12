import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/components/pc/utils/games_picker_p_c/games_picker_p_c_widget.dart';
import '/components/pc/utils/pc_background_image/pc_background_image_widget.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import '/index.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'tournament_model.dart';
export 'tournament_model.dart';

class TournamentWidget extends StatefulWidget {
  const TournamentWidget({super.key});

  static String routeName = 'tournament';
  static String routePath = '/tournament';

  @override
  State<TournamentWidget> createState() => _TournamentWidgetState();
}

class _TournamentWidgetState extends State<TournamentWidget>
    with TickerProviderStateMixin {
  late TournamentModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => TournamentModel());

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

          _model.runningTournament =
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

          _model.upcomingTournament =
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

          _model.pastTournament =
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
        body: Stack(
          children: [
            Align(
              alignment: AlignmentDirectional(0.0, -1.0),
              child: wrapWithModel(
                model: _model.pcBackgroundImageModel,
                updateCallback: () => safeSetState(() {}),
                child: PcBackgroundImageWidget(),
              ),
            ),
            Align(
              alignment: AlignmentDirectional(0.0, 0.0),
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(100.0, 0.0, 100.0, 0.0),
                child: Container(
                  width: 1150.0,
                  child: Stack(
                    children: [
                      Align(
                        alignment: AlignmentDirectional(0.0, -1.0),
                        child: Padding(
                          padding: EdgeInsetsDirectional.fromSTEB(
                              0.0, 165.0, 0.0, 0.0),
                          child: SingleChildScrollView(
                            child: Column(
                              mainAxisSize: MainAxisSize.max,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                wrapWithModel(
                                  model: _model.gamesPickerPCModel,
                                  updateCallback: () => safeSetState(() {}),
                                  child: GamesPickerPCWidget(),
                                ),
                                Align(
                                  alignment: AlignmentDirectional(-1.0, 0.0),
                                  child: Padding(
                                    padding: EdgeInsetsDirectional.fromSTEB(
                                        0.0, 30.0, 0.0, 0.0),
                                    child: Container(
                                      height:
                                          MediaQuery.sizeOf(context).height *
                                              0.6,
                                      constraints: BoxConstraints(
                                        maxWidth: 1150.0,
                                      ),
                                      decoration: BoxDecoration(),
                                      child: Column(
                                        children: [
                                          Align(
                                            alignment: Alignment(0.0, 0),
                                            child: TabBar(
                                              labelColor:
                                                  FlutterFlowTheme.of(context)
                                                      .primaryText,
                                              unselectedLabelColor:
                                                  FlutterFlowTheme.of(context)
                                                      .secondaryText,
                                              labelStyle: FlutterFlowTheme.of(
                                                      context)
                                                  .titleMedium
                                                  .override(
                                                    font: GoogleFonts.dmSans(
                                                      fontWeight:
                                                          FontWeight.w600,
                                                      fontStyle:
                                                          FlutterFlowTheme.of(
                                                                  context)
                                                              .titleMedium
                                                              .fontStyle,
                                                    ),
                                                    fontSize: 14.0,
                                                    letterSpacing: 0.0,
                                                    fontWeight: FontWeight.w600,
                                                    fontStyle:
                                                        FlutterFlowTheme.of(
                                                                context)
                                                            .titleMedium
                                                            .fontStyle,
                                                  ),
                                              unselectedLabelStyle: TextStyle(),
                                              indicatorColor:
                                                  FlutterFlowTheme.of(context)
                                                      .secondary,
                                              tabs: [
                                                Tab(
                                                  text: FFLocalizations.of(
                                                          context)
                                                      .getText(
                                                    'khzu9ibt' /* Live Tournaments */,
                                                  ),
                                                ),
                                                Tab(
                                                  text: FFLocalizations.of(
                                                          context)
                                                      .getText(
                                                    'cm9ohpm1' /* Upcoming Tournaments */,
                                                  ),
                                                ),
                                                Tab(
                                                  text: FFLocalizations.of(
                                                          context)
                                                      .getText(
                                                    'ydo3fh2n' /* Past Tournaments */,
                                                  ),
                                                ),
                                              ],
                                              controller:
                                                  _model.tabBarController,
                                              onTap: (i) async {
                                                [
                                                  () async {},
                                                  () async {},
                                                  () async {}
                                                ][i]();
                                              },
                                            ),
                                          ),
                                          Expanded(
                                            child: TabBarView(
                                              controller:
                                                  _model.tabBarController,
                                              children: [
                                                Column(
                                                  mainAxisSize:
                                                      MainAxisSize.max,
                                                  children: [
                                                    Expanded(
                                                      child: Builder(
                                                        builder: (context) {
                                                          final running = _model
                                                              .runningTournament
                                                              .toList();

                                                          return ListView
                                                              .builder(
                                                            padding:
                                                                EdgeInsets.zero,
                                                            shrinkWrap: true,
                                                            scrollDirection:
                                                                Axis.vertical,
                                                            itemCount:
                                                                running.length,
                                                            itemBuilder: (context,
                                                                runningIndex) {
                                                              final runningItem =
                                                                  running[
                                                                      runningIndex];
                                                              return Align(
                                                                alignment:
                                                                    AlignmentDirectional(
                                                                        0.0,
                                                                        1.0),
                                                                child: InkWell(
                                                                  splashColor:
                                                                      Colors
                                                                          .transparent,
                                                                  focusColor: Colors
                                                                      .transparent,
                                                                  hoverColor: Colors
                                                                      .transparent,
                                                                  highlightColor:
                                                                      Colors
                                                                          .transparent,
                                                                  onTap:
                                                                      () async {
                                                                    context
                                                                        .pushNamed(
                                                                      UniqueEventWidget
                                                                          .routeName,
                                                                      queryParameters:
                                                                          {
                                                                        'event':
                                                                            serializeParam(
                                                                          getJsonField(
                                                                            runningItem,
                                                                            r'''$''',
                                                                          ),
                                                                          ParamType
                                                                              .JSON,
                                                                        ),
                                                                      }.withoutNulls,
                                                                    );
                                                                  },
                                                                  child:
                                                                      Container(
                                                                    width: double
                                                                        .infinity,
                                                                    height:
                                                                        100.0,
                                                                    decoration:
                                                                        BoxDecoration(
                                                                      image:
                                                                          DecorationImage(
                                                                        fit: BoxFit
                                                                            .cover,
                                                                        alignment: AlignmentDirectional(
                                                                            0.0,
                                                                            0.0),
                                                                        image: Image
                                                                            .asset(
                                                                          'assets/images/esports-hero.jpg',
                                                                        ).image,
                                                                      ),
                                                                      borderRadius:
                                                                          BorderRadius.circular(
                                                                              0.0),
                                                                    ),
                                                                    alignment:
                                                                        AlignmentDirectional(
                                                                            0.0,
                                                                            1.0),
                                                                    child:
                                                                        Stack(
                                                                      children: [
                                                                        Container(
                                                                          width:
                                                                              double.infinity,
                                                                          height:
                                                                              100.0,
                                                                          decoration:
                                                                              BoxDecoration(
                                                                            gradient:
                                                                                LinearGradient(
                                                                              colors: [
                                                                                Color(0x00050A11),
                                                                                FlutterFlowTheme.of(context).backgroundHome
                                                                              ],
                                                                              stops: [
                                                                                0.0,
                                                                                1.0
                                                                              ],
                                                                              begin: AlignmentDirectional(1.0, 0.0),
                                                                              end: AlignmentDirectional(-1.0, 0),
                                                                            ),
                                                                          ),
                                                                          child:
                                                                              Padding(
                                                                            padding: EdgeInsetsDirectional.fromSTEB(
                                                                                10.0,
                                                                                0.0,
                                                                                10.0,
                                                                                0.0),
                                                                            child:
                                                                                Row(
                                                                              mainAxisSize: MainAxisSize.max,
                                                                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                                              children: [
                                                                                Row(
                                                                                  mainAxisSize: MainAxisSize.max,
                                                                                  children: [
                                                                                    Container(
                                                                                      width: 50.0,
                                                                                      height: 50.0,
                                                                                      decoration: BoxDecoration(
                                                                                        color: Colors.white,
                                                                                        borderRadius: BorderRadius.circular(50.0),
                                                                                      ),
                                                                                      alignment: AlignmentDirectional(0.0, 0.0),
                                                                                      child: ClipRRect(
                                                                                        borderRadius: BorderRadius.circular(8.0),
                                                                                        child: Image.network(
                                                                                          getJsonField(
                                                                                            runningItem,
                                                                                            r'''$.league.image_url''',
                                                                                          ).toString(),
                                                                                          width: 35.0,
                                                                                          height: 35.0,
                                                                                          fit: BoxFit.contain,
                                                                                        ),
                                                                                      ),
                                                                                    ),
                                                                                    Padding(
                                                                                      padding: EdgeInsetsDirectional.fromSTEB(15.0, 26.0, 0.0, 26.0),
                                                                                      child: Column(
                                                                                        mainAxisSize: MainAxisSize.max,
                                                                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                                                        crossAxisAlignment: CrossAxisAlignment.start,
                                                                                        children: [
                                                                                          Text(
                                                                                            getJsonField(
                                                                                              runningItem,
                                                                                              r'''$.league.name''',
                                                                                            ).toString(),
                                                                                            style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                                  font: GoogleFonts.inter(
                                                                                                    fontWeight: FontWeight.w600,
                                                                                                    fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                                  ),
                                                                                                  fontSize: 14.0,
                                                                                                  letterSpacing: 0.0,
                                                                                                  fontWeight: FontWeight.w600,
                                                                                                  fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                                ),
                                                                                          ),
                                                                                          Text(
                                                                                            '${dateTimeFormat(
                                                                                              "d/M/y",
                                                                                              DateTime.fromMillisecondsSinceEpoch(getJsonField(
                                                                                                runningItem,
                                                                                                r'''$.begin_at''',
                                                                                              )),
                                                                                              locale: FFLocalizations.of(context).languageCode,
                                                                                            )} - ${dateTimeFormat(
                                                                                              "d/M/y",
                                                                                              DateTime.fromMillisecondsSinceEpoch(getJsonField(
                                                                                                runningItem,
                                                                                                r'''$.end_at''',
                                                                                              )),
                                                                                              locale: FFLocalizations.of(context).languageCode,
                                                                                            )}',
                                                                                            style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                                  font: GoogleFonts.inter(
                                                                                                    fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                                    fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                                  ),
                                                                                                  fontSize: 12.0,
                                                                                                  letterSpacing: 0.0,
                                                                                                  fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                                  fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
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
                                                                                    borderRadius: BorderRadius.circular(10.0),
                                                                                  ),
                                                                                  child: Align(
                                                                                    alignment: AlignmentDirectional(0.0, 0.0),
                                                                                    child: Padding(
                                                                                      padding: EdgeInsetsDirectional.fromSTEB(10.0, 0.0, 10.0, 0.0),
                                                                                      child: Text(
                                                                                        valueOrDefault<String>(
                                                                                          getJsonField(
                                                                                            runningItem,
                                                                                            r'''$.videogame.name''',
                                                                                          )?.toString(),
                                                                                          'Counter Strike',
                                                                                        ),
                                                                                        style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                              font: GoogleFonts.inter(
                                                                                                fontWeight: FontWeight.w600,
                                                                                                fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                              ),
                                                                                              color: Color(0xFF050A11),
                                                                                              fontSize: 11.0,
                                                                                              letterSpacing: 0.0,
                                                                                              fontWeight: FontWeight.w600,
                                                                                              fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
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
                                                    ),
                                                  ],
                                                ),
                                                Column(
                                                  mainAxisSize:
                                                      MainAxisSize.max,
                                                  children: [
                                                    Builder(
                                                      builder: (context) {
                                                        final upcoming = _model
                                                            .upcomingTournament
                                                            .toList();

                                                        return ListView.builder(
                                                          padding:
                                                              EdgeInsets.zero,
                                                          shrinkWrap: true,
                                                          scrollDirection:
                                                              Axis.vertical,
                                                          itemCount:
                                                              upcoming.length,
                                                          itemBuilder: (context,
                                                              upcomingIndex) {
                                                            final upcomingItem =
                                                                upcoming[
                                                                    upcomingIndex];
                                                            return Align(
                                                              alignment:
                                                                  AlignmentDirectional(
                                                                      0.0, 1.0),
                                                              child: InkWell(
                                                                splashColor: Colors
                                                                    .transparent,
                                                                focusColor: Colors
                                                                    .transparent,
                                                                hoverColor: Colors
                                                                    .transparent,
                                                                highlightColor:
                                                                    Colors
                                                                        .transparent,
                                                                onTap:
                                                                    () async {
                                                                  context
                                                                      .pushNamed(
                                                                    UniqueEventWidget
                                                                        .routeName,
                                                                    queryParameters:
                                                                        {
                                                                      'event':
                                                                          serializeParam(
                                                                        upcomingItem,
                                                                        ParamType
                                                                            .JSON,
                                                                      ),
                                                                    }.withoutNulls,
                                                                  );
                                                                },
                                                                child:
                                                                    Container(
                                                                  width: double
                                                                      .infinity,
                                                                  height: 100.0,
                                                                  decoration:
                                                                      BoxDecoration(
                                                                    image:
                                                                        DecorationImage(
                                                                      fit: BoxFit
                                                                          .cover,
                                                                      alignment:
                                                                          AlignmentDirectional(
                                                                              0.0,
                                                                              0.0),
                                                                      image: Image
                                                                          .asset(
                                                                        'assets/images/esports-hero.jpg',
                                                                      ).image,
                                                                    ),
                                                                    borderRadius:
                                                                        BorderRadius.circular(
                                                                            0.0),
                                                                  ),
                                                                  alignment:
                                                                      AlignmentDirectional(
                                                                          0.0,
                                                                          1.0),
                                                                  child: Stack(
                                                                    children: [
                                                                      Container(
                                                                        width: double
                                                                            .infinity,
                                                                        height:
                                                                            100.0,
                                                                        decoration:
                                                                            BoxDecoration(
                                                                          gradient:
                                                                              LinearGradient(
                                                                            colors: [
                                                                              Color(0x00050A11),
                                                                              FlutterFlowTheme.of(context).backgroundHome
                                                                            ],
                                                                            stops: [
                                                                              0.0,
                                                                              1.0
                                                                            ],
                                                                            begin:
                                                                                AlignmentDirectional(1.0, 0.0),
                                                                            end:
                                                                                AlignmentDirectional(-1.0, 0),
                                                                          ),
                                                                        ),
                                                                        child:
                                                                            Padding(
                                                                          padding: EdgeInsetsDirectional.fromSTEB(
                                                                              10.0,
                                                                              0.0,
                                                                              10.0,
                                                                              0.0),
                                                                          child:
                                                                              Row(
                                                                            mainAxisSize:
                                                                                MainAxisSize.max,
                                                                            mainAxisAlignment:
                                                                                MainAxisAlignment.spaceBetween,
                                                                            children: [
                                                                              Row(
                                                                                mainAxisSize: MainAxisSize.max,
                                                                                children: [
                                                                                  Container(
                                                                                    width: 50.0,
                                                                                    height: 50.0,
                                                                                    decoration: BoxDecoration(
                                                                                      color: Colors.white,
                                                                                      borderRadius: BorderRadius.circular(50.0),
                                                                                    ),
                                                                                    alignment: AlignmentDirectional(0.0, 0.0),
                                                                                    child: ClipRRect(
                                                                                      borderRadius: BorderRadius.circular(8.0),
                                                                                      child: Image.network(
                                                                                        getJsonField(
                                                                                          upcomingItem,
                                                                                          r'''$.league.image_url''',
                                                                                        ).toString(),
                                                                                        width: 35.0,
                                                                                        height: 35.0,
                                                                                        fit: BoxFit.contain,
                                                                                      ),
                                                                                    ),
                                                                                  ),
                                                                                  Padding(
                                                                                    padding: EdgeInsetsDirectional.fromSTEB(15.0, 26.0, 0.0, 26.0),
                                                                                    child: Column(
                                                                                      mainAxisSize: MainAxisSize.max,
                                                                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                                                      crossAxisAlignment: CrossAxisAlignment.start,
                                                                                      children: [
                                                                                        Text(
                                                                                          getJsonField(
                                                                                            upcomingItem,
                                                                                            r'''$.league.name''',
                                                                                          ).toString(),
                                                                                          style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                                font: GoogleFonts.inter(
                                                                                                  fontWeight: FontWeight.w600,
                                                                                                  fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                                ),
                                                                                                fontSize: 14.0,
                                                                                                letterSpacing: 0.0,
                                                                                                fontWeight: FontWeight.w600,
                                                                                                fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                              ),
                                                                                        ),
                                                                                        Text(
                                                                                          '${dateTimeFormat(
                                                                                            "d/M/y",
                                                                                            DateTime.fromMillisecondsSinceEpoch(getJsonField(
                                                                                              upcomingItem,
                                                                                              r'''$.begin_at''',
                                                                                            )),
                                                                                            locale: FFLocalizations.of(context).languageCode,
                                                                                          )} - ${getJsonField(
                                                                                            upcomingItem,
                                                                                            r'''$.end_at''',
                                                                                          ).toString()}',
                                                                                          style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                                font: GoogleFonts.inter(
                                                                                                  fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                                  fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                                ),
                                                                                                fontSize: 12.0,
                                                                                                letterSpacing: 0.0,
                                                                                                fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                                fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
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
                                                                                  borderRadius: BorderRadius.circular(10.0),
                                                                                ),
                                                                                child: Align(
                                                                                  alignment: AlignmentDirectional(0.0, 0.0),
                                                                                  child: Padding(
                                                                                    padding: EdgeInsetsDirectional.fromSTEB(10.0, 0.0, 10.0, 0.0),
                                                                                    child: Text(
                                                                                      valueOrDefault<String>(
                                                                                        getJsonField(
                                                                                          upcomingItem,
                                                                                          r'''$.videogame.name''',
                                                                                        )?.toString(),
                                                                                        'Counter Strike',
                                                                                      ),
                                                                                      style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                            font: GoogleFonts.inter(
                                                                                              fontWeight: FontWeight.w600,
                                                                                              fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                            ),
                                                                                            color: Color(0xFF050A11),
                                                                                            fontSize: 11.0,
                                                                                            letterSpacing: 0.0,
                                                                                            fontWeight: FontWeight.w600,
                                                                                            fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
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
                                                Column(
                                                  mainAxisSize:
                                                      MainAxisSize.max,
                                                  children: [
                                                    Builder(
                                                      builder: (context) {
                                                        final past = _model
                                                            .pastTournament
                                                            .toList();

                                                        return ListView.builder(
                                                          padding:
                                                              EdgeInsets.zero,
                                                          shrinkWrap: true,
                                                          scrollDirection:
                                                              Axis.vertical,
                                                          itemCount:
                                                              past.length,
                                                          itemBuilder: (context,
                                                              pastIndex) {
                                                            final pastItem =
                                                                past[pastIndex];
                                                            return Align(
                                                              alignment:
                                                                  AlignmentDirectional(
                                                                      0.0, 1.0),
                                                              child: InkWell(
                                                                splashColor: Colors
                                                                    .transparent,
                                                                focusColor: Colors
                                                                    .transparent,
                                                                hoverColor: Colors
                                                                    .transparent,
                                                                highlightColor:
                                                                    Colors
                                                                        .transparent,
                                                                onTap:
                                                                    () async {
                                                                  context
                                                                      .pushNamed(
                                                                    UniqueEventWidget
                                                                        .routeName,
                                                                    queryParameters:
                                                                        {
                                                                      'event':
                                                                          serializeParam(
                                                                        pastItem,
                                                                        ParamType
                                                                            .JSON,
                                                                      ),
                                                                    }.withoutNulls,
                                                                  );
                                                                },
                                                                child:
                                                                    Container(
                                                                  width: double
                                                                      .infinity,
                                                                  height: 100.0,
                                                                  decoration:
                                                                      BoxDecoration(
                                                                    image:
                                                                        DecorationImage(
                                                                      fit: BoxFit
                                                                          .cover,
                                                                      alignment:
                                                                          AlignmentDirectional(
                                                                              0.0,
                                                                              0.0),
                                                                      image: Image
                                                                          .asset(
                                                                        'assets/images/esports-hero.jpg',
                                                                      ).image,
                                                                    ),
                                                                    borderRadius:
                                                                        BorderRadius.circular(
                                                                            0.0),
                                                                  ),
                                                                  alignment:
                                                                      AlignmentDirectional(
                                                                          0.0,
                                                                          1.0),
                                                                  child: Stack(
                                                                    children: [
                                                                      Container(
                                                                        width: double
                                                                            .infinity,
                                                                        height:
                                                                            100.0,
                                                                        decoration:
                                                                            BoxDecoration(
                                                                          gradient:
                                                                              LinearGradient(
                                                                            colors: [
                                                                              Color(0x00050A11),
                                                                              FlutterFlowTheme.of(context).backgroundHome
                                                                            ],
                                                                            stops: [
                                                                              0.0,
                                                                              1.0
                                                                            ],
                                                                            begin:
                                                                                AlignmentDirectional(1.0, 0.0),
                                                                            end:
                                                                                AlignmentDirectional(-1.0, 0),
                                                                          ),
                                                                        ),
                                                                        child:
                                                                            Padding(
                                                                          padding: EdgeInsetsDirectional.fromSTEB(
                                                                              10.0,
                                                                              0.0,
                                                                              10.0,
                                                                              0.0),
                                                                          child:
                                                                              Row(
                                                                            mainAxisSize:
                                                                                MainAxisSize.max,
                                                                            mainAxisAlignment:
                                                                                MainAxisAlignment.spaceBetween,
                                                                            children: [
                                                                              Row(
                                                                                mainAxisSize: MainAxisSize.max,
                                                                                children: [
                                                                                  Container(
                                                                                    width: 50.0,
                                                                                    height: 50.0,
                                                                                    decoration: BoxDecoration(
                                                                                      color: Colors.white,
                                                                                      borderRadius: BorderRadius.circular(50.0),
                                                                                    ),
                                                                                    alignment: AlignmentDirectional(0.0, 0.0),
                                                                                    child: ClipRRect(
                                                                                      borderRadius: BorderRadius.circular(8.0),
                                                                                      child: Image.network(
                                                                                        getJsonField(
                                                                                          pastItem,
                                                                                          r'''$.league.image_url''',
                                                                                        ).toString(),
                                                                                        width: 35.0,
                                                                                        height: 35.0,
                                                                                        fit: BoxFit.contain,
                                                                                      ),
                                                                                    ),
                                                                                  ),
                                                                                  Padding(
                                                                                    padding: EdgeInsetsDirectional.fromSTEB(15.0, 26.0, 0.0, 26.0),
                                                                                    child: Column(
                                                                                      mainAxisSize: MainAxisSize.max,
                                                                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                                                      crossAxisAlignment: CrossAxisAlignment.start,
                                                                                      children: [
                                                                                        Text(
                                                                                          getJsonField(
                                                                                            pastItem,
                                                                                            r'''$.league.name''',
                                                                                          ).toString(),
                                                                                          style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                                font: GoogleFonts.inter(
                                                                                                  fontWeight: FontWeight.w600,
                                                                                                  fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                                ),
                                                                                                fontSize: 14.0,
                                                                                                letterSpacing: 0.0,
                                                                                                fontWeight: FontWeight.w600,
                                                                                                fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                              ),
                                                                                        ),
                                                                                        Text(
                                                                                          '${dateTimeFormat(
                                                                                            "d/M/y",
                                                                                            DateTime.fromMillisecondsSinceEpoch(getJsonField(
                                                                                              pastItem,
                                                                                              r'''$.begin_at''',
                                                                                            )),
                                                                                            locale: FFLocalizations.of(context).languageCode,
                                                                                          )} - ${dateTimeFormat(
                                                                                            "d/M/y",
                                                                                            DateTime.fromMillisecondsSinceEpoch(getJsonField(
                                                                                              pastItem,
                                                                                              r'''$.end_at''',
                                                                                            )),
                                                                                            locale: FFLocalizations.of(context).languageCode,
                                                                                          )}',
                                                                                          style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                                font: GoogleFonts.inter(
                                                                                                  fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                                  fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                                ),
                                                                                                fontSize: 12.0,
                                                                                                letterSpacing: 0.0,
                                                                                                fontWeight: FlutterFlowTheme.of(context).bodyMedium.fontWeight,
                                                                                                fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
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
                                                                                  borderRadius: BorderRadius.circular(10.0),
                                                                                ),
                                                                                child: Align(
                                                                                  alignment: AlignmentDirectional(0.0, 0.0),
                                                                                  child: Padding(
                                                                                    padding: EdgeInsetsDirectional.fromSTEB(10.0, 0.0, 10.0, 0.0),
                                                                                    child: Text(
                                                                                      valueOrDefault<String>(
                                                                                        getJsonField(
                                                                                          pastItem,
                                                                                          r'''$.videogame.name''',
                                                                                        )?.toString(),
                                                                                        'Counter Strike',
                                                                                      ),
                                                                                      style: FlutterFlowTheme.of(context).bodyMedium.override(
                                                                                            font: GoogleFonts.inter(
                                                                                              fontWeight: FontWeight.w600,
                                                                                              fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
                                                                                            ),
                                                                                            color: Color(0xFF050A11),
                                                                                            fontSize: 11.0,
                                                                                            letterSpacing: 0.0,
                                                                                            fontWeight: FontWeight.w600,
                                                                                            fontStyle: FlutterFlowTheme.of(context).bodyMedium.fontStyle,
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
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Align(
              alignment: AlignmentDirectional(0.0, -1.0),
              child: wrapWithModel(
                model: _model.navBarPCModel,
                updateCallback: () => safeSetState(() {}),
                child: NavBarPCWidget(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
