import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'dart:ui';
import '/index.dart';
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'nav_bar_home_model.dart';
export 'nav_bar_home_model.dart';

class NavBarHomeWidget extends StatefulWidget {
  const NavBarHomeWidget({super.key});

  @override
  State<NavBarHomeWidget> createState() => _NavBarHomeWidgetState();
}

class _NavBarHomeWidgetState extends State<NavBarHomeWidget> {
  late NavBarHomeModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => NavBarHomeModel());

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Visibility(
      visible: responsiveVisibility(
        context: context,
        desktop: false,
      ),
      child: Container(
        width: double.infinity,
        height: 80.0,
        decoration: BoxDecoration(
          color: FlutterFlowTheme.of(context).backgroundNav,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(0.0),
          child: BackdropFilter(
            filter: ImageFilter.blur(
              sigmaX: 1.5,
              sigmaY: 1.5,
            ),
            child: Visibility(
              visible: responsiveVisibility(
                context: context,
                desktop: false,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.max,
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  FlutterFlowIconButton(
                    borderRadius: 8.0,
                    buttonSize: 60.0,
                    icon: FaIcon(
                      FontAwesomeIcons.home,
                      color: Color(0xFF434B64),
                      size: 20.0,
                    ),
                    onPressed: () async {
                      context.pushNamed(
                        HomeWidget.routeName,
                        extra: <String, dynamic>{
                          kTransitionInfoKey: TransitionInfo(
                            hasTransition: true,
                            transitionType: PageTransitionType.fade,
                            duration: Duration(milliseconds: 0),
                          ),
                        },
                      );
                    },
                  ),
                  FlutterFlowIconButton(
                    borderRadius: 8.0,
                    buttonSize: 60.0,
                    icon: FaIcon(
                      FontAwesomeIcons.trophy,
                      color: Color(0xFF434B64),
                      size: 21.0,
                    ),
                    onPressed: () async {
                      context.pushNamed(
                        EventMobilePageWidget.routeName,
                        extra: <String, dynamic>{
                          kTransitionInfoKey: TransitionInfo(
                            hasTransition: true,
                            transitionType: PageTransitionType.fade,
                            duration: Duration(milliseconds: 0),
                          ),
                        },
                      );
                    },
                  ),
                  FlutterFlowIconButton(
                    borderRadius: 8.0,
                    buttonSize: 70.0,
                    icon: Icon(
                      Icons.calendar_today,
                      color: Color(0xFF434B64),
                      size: 24.0,
                    ),
                    onPressed: () async {
                      context.pushNamed(
                        CalendarWidget.routeName,
                        extra: <String, dynamic>{
                          kTransitionInfoKey: TransitionInfo(
                            hasTransition: true,
                            transitionType: PageTransitionType.fade,
                            duration: Duration(milliseconds: 0),
                          ),
                        },
                      );
                    },
                  ),
                  FlutterFlowIconButton(
                    borderRadius: 8.0,
                    buttonSize: 70.0,
                    icon: Icon(
                      Icons.article,
                      color: Color(0xFF434B64),
                      size: 30.0,
                    ),
                    onPressed: () async {
                      context.pushNamed(
                        ArticlesPageWidget.routeName,
                        extra: <String, dynamic>{
                          kTransitionInfoKey: TransitionInfo(
                            hasTransition: true,
                            transitionType: PageTransitionType.fade,
                            duration: Duration(milliseconds: 0),
                          ),
                        },
                      );
                    },
                  ),
                  FlutterFlowIconButton(
                    borderRadius: 8.0,
                    buttonSize: 70.0,
                    icon: Icon(
                      Icons.person_rounded,
                      color: Color(0xFF434B64),
                      size: 31.0,
                    ),
                    onPressed: () async {
                      context.pushNamed(
                        ProfilWidget.routeName,
                        extra: <String, dynamic>{
                          kTransitionInfoKey: TransitionInfo(
                            hasTransition: true,
                            transitionType: PageTransitionType.fade,
                            duration: Duration(milliseconds: 0),
                          ),
                        },
                      );
                    },
                  ),
                ].divide(SizedBox(width: 10.0)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
