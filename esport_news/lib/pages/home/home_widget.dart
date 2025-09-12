import '/auth/custom_auth/auth_util.dart';
import '/backend/api_requests/api_calls.dart';
import '/backend/custom_cloud_functions/custom_cloud_function_response_manager.dart';
import '/components/ads_widget.dart';
import '/components/event_container/event_container_widget.dart';
import '/components/mobile/nav/nav_bar_home/nav_bar_home_widget.dart';
import '/components/mobile/nav/top_bar_mobile_home/top_bar_mobile_home_widget.dart';
import '/components/mobile/utils/match_live_component_mobile/match_live_component_mobile_widget.dart';
import '/components/news_widget.dart';
import '/components/pc/nav_bar_p_c/nav_bar_p_c_widget.dart';
import '/components/pc/utils/games_picker_p_c/games_picker_p_c_widget.dart';
import '/components/pc/utils/home_event_container/home_event_container_widget.dart';
import '/components/pc/utils/match_live_component/match_live_component_widget.dart';
import '/components/pc/utils/pc_background_image/pc_background_image_widget.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_spinkit/flutter_spinkit.dart';
import 'package:provider/provider.dart';
import 'home_model.dart';
export 'home_model.dart';

class HomeWidget extends StatefulWidget {
  const HomeWidget({super.key});

  static String routeName = 'Home';
  static String routePath = '/home';

  @override
  State<HomeWidget> createState() => _HomeWidgetState();
}

class _HomeWidgetState extends State<HomeWidget> {
  late HomeModel _model;

  final scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => HomeModel());

    // On page load action.
    SchedulerBinding.instance.addPostFrameCallback((_) async {
      await Future.wait([
        Future(() async {
          if (!FFAppState().isConnected) {
            if (currentAuthenticationToken != null &&
                currentAuthenticationToken != '') {
              _model.outputReceiveDataUser = await AuthToUserCall.call(
                authToken: currentAuthenticationToken,
              );

              if ((_model.outputReceiveDataUser?.succeeded ?? true)) {
                FFAppState().userEmail = getJsonField(
                  (_model.outputReceiveDataUser?.jsonBody ?? ''),
                  r'''$.email''',
                ).toString();
                FFAppState().userName = getJsonField(
                  (_model.outputReceiveDataUser?.jsonBody ?? ''),
                  r'''$.name''',
                ).toString();
                FFAppState().userPhoto = getJsonField(
                  (_model.outputReceiveDataUser?.jsonBody ?? ''),
                  r'''$.photo.url''',
                ).toString();
                FFAppState().photoUploaded = getJsonField(
                  (_model.outputReceiveDataUser?.jsonBody ?? ''),
                  r'''$.photoUploaded''',
                );
                FFAppState().admin = getJsonField(
                  (_model.outputReceiveDataUser?.jsonBody ?? ''),
                  r'''$.admin''',
                );
                FFAppState().favoriteTeam = getJsonField(
                  (_model.outputReceiveDataUser?.jsonBody ?? ''),
                  r'''$.favorite_team''',
                );
                FFAppState().userId = getJsonField(
                  (_model.outputReceiveDataUser?.jsonBody ?? ''),
                  r'''$.id''',
                );
                FFAppState().update(() {});
                FFAppState().isConnected = true;
                FFAppState().update(() {});
              } else {
                FFAppState().isConnected = false;
                FFAppState().update(() {});
              }
            } else {
              FFAppState().isConnected = false;
              FFAppState().update(() {});
            }
          }
        }),
        Future(() async {
          _model.apiResultxht = await PandascoreGroup.fetchAllTeamsCall.call();

          if ((_model.apiResultxht?.succeeded ?? true)) {
            _model.listTeams =
                (_model.apiResultxht?.jsonBody ?? '').toList().cast<dynamic>();
            safeSetState(() {});
          }
        }),
        Future(() async {
          try {
            final result =
                await FirebaseFunctions.instanceFor(region: 'europe-west1')
                    .httpsCallable('getActiveAds')
                    .call({});
            _model.cloudFunction2ap = GetActiveAdsCloudFunctionCallResponse(
              data: (result.data as List?)?.map((i) => i as dynamic).toList(),
              succeeded: true,
              resultAsString: result.data.toString(),
              jsonBody: result.data,
            );
          } on FirebaseFunctionsException catch (error) {
            _model.cloudFunction2ap = GetActiveAdsCloudFunctionCallResponse(
              errorCode: error.code,
              succeeded: false,
            );
          }

          if (_model.cloudFunction2ap!.succeeded!) {
            FFAppState().ads =
                _model.cloudFunction2ap!.jsonBody!.toList().cast<dynamic>();
            FFAppState().update(() {});
          }
        }),
      ]);
    });

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

    return FutureBuilder<ApiCallResponse>(
      future: EsportDevsGroup.liveMatchCall.call(),
      builder: (context, snapshot) {
        // Customize what your widget looks like when it's loading.
        if (!snapshot.hasData) {
          return Scaffold(
            backgroundColor: FlutterFlowTheme.of(context).primary,
            body: Center(
              child: SizedBox(
                width: 30.0,
                height: 30.0,
                child: SpinKitFadingCube(
                  color: FlutterFlowTheme.of(context).secondary,
                  size: 30.0,
                ),
              ),
            ),
          );
        }
        final homeLiveMatchResponse = snapshot.data!;

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
                if (responsiveVisibility(
                  context: context,
                  tablet: false,
                  tabletLandscape: false,
                  desktop: false,
                ))
                  Container(
                    decoration: BoxDecoration(),
                    child: Stack(
                      children: [
                        Padding(
                          padding: EdgeInsetsDirectional.fromSTEB(
                              0.0, 100.0, 0.0, 0.0),
                          child: SingleChildScrollView(
                            child: Column(
                              mainAxisSize: MainAxisSize.max,
                              mainAxisAlignment: MainAxisAlignment.start,
                              children: [
                                wrapWithModel(
                                  model: _model.matchLiveComponentMobileModel,
                                  updateCallback: () => safeSetState(() {}),
                                  updateOnChange: true,
                                  child: MatchLiveComponentMobileWidget(),
                                ),
                                wrapWithModel(
                                  model: _model.eventContainerModel,
                                  updateCallback: () => safeSetState(() {}),
                                  updateOnChange: true,
                                  child: EventContainerWidget(),
                                ),
                              ],
                            ),
                          ),
                        ),
                        Padding(
                          padding: EdgeInsetsDirectional.fromSTEB(
                              15.0, 40.0, 15.0, 20.0),
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
                if (responsiveVisibility(
                  context: context,
                  phone: false,
                ))
                  Container(
                    width: double.infinity,
                    height: double.infinity,
                    decoration: BoxDecoration(),
                    child: Stack(
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
                            padding: EdgeInsetsDirectional.fromSTEB(
                                100.0, 0.0, 100.0, 0.0),
                            child: Container(
                              width: 1500.0,
                              child: Stack(
                                children: [
                                  Align(
                                    alignment: AlignmentDirectional(0.0, -1.0),
                                    child: Padding(
                                      padding: EdgeInsetsDirectional.fromSTEB(
                                          0.0, 180.0, 0.0, 0.0),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.max,
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Expanded(
                                            child: Column(
                                              mainAxisSize: MainAxisSize.max,
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.end,
                                              children: [
                                                wrapWithModel(
                                                  model:
                                                      _model.gamesPickerPCModel,
                                                  updateCallback: () =>
                                                      safeSetState(() {}),
                                                  updateOnChange: true,
                                                  child: GamesPickerPCWidget(),
                                                ),
                                                Expanded(
                                                  child: Row(
                                                    mainAxisSize:
                                                        MainAxisSize.max,
                                                    mainAxisAlignment:
                                                        MainAxisAlignment
                                                            .spaceBetween,
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment
                                                            .start,
                                                    children: [
                                                      Expanded(
                                                        child: Column(
                                                          mainAxisSize:
                                                              MainAxisSize.max,
                                                          children: [
                                                            wrapWithModel(
                                                              model: _model
                                                                  .matchLiveComponentModel,
                                                              updateCallback: () =>
                                                                  safeSetState(
                                                                      () {}),
                                                              child:
                                                                  MatchLiveComponentWidget(),
                                                            ),
                                                            Expanded(
                                                              child:
                                                                  wrapWithModel(
                                                                model: _model
                                                                    .newsModel,
                                                                updateCallback: () =>
                                                                    safeSetState(
                                                                        () {}),
                                                                child:
                                                                    NewsWidget(),
                                                              ),
                                                            ),
                                                          ],
                                                        ),
                                                      ),
                                                      Padding(
                                                        padding:
                                                            EdgeInsetsDirectional
                                                                .fromSTEB(
                                                                    0.0,
                                                                    20.0,
                                                                    0.0,
                                                                    0.0),
                                                        child: wrapWithModel(
                                                          model: _model
                                                              .homeEventContainerModel,
                                                          updateCallback: () =>
                                                              safeSetState(
                                                                  () {}),
                                                          child:
                                                              HomeEventContainerWidget(),
                                                        ),
                                                      ),
                                                    ].divide(
                                                        SizedBox(width: 20.0)),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          wrapWithModel(
                                            model: _model.adsModel,
                                            updateCallback: () =>
                                                safeSetState(() {}),
                                            child: AdsWidget(),
                                          ),
                                        ].divide(SizedBox(width: 50.0)),
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
              ],
            ),
          ),
        );
      },
    );
  }
}
