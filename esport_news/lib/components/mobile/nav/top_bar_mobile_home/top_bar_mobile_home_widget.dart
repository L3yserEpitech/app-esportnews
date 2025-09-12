import '/components/mobile/utils/mobal_select_game_teams_mobile/mobal_select_game_teams_mobile_widget.dart';
import '/components/utils/logo/logo_widget.dart';
import '/flutter_flow/flutter_flow_icon_button.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'package:badges/badges.dart' as badges;
import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:webviewx_plus/webviewx_plus.dart';
import 'top_bar_mobile_home_model.dart';
export 'top_bar_mobile_home_model.dart';

class TopBarMobileHomeWidget extends StatefulWidget {
  const TopBarMobileHomeWidget({super.key});

  @override
  State<TopBarMobileHomeWidget> createState() => _TopBarMobileHomeWidgetState();
}

class _TopBarMobileHomeWidgetState extends State<TopBarMobileHomeWidget> {
  late TopBarMobileHomeModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => TopBarMobileHomeModel());

    WidgetsBinding.instance.addPostFrameCallback((_) => safeSetState(() {}));
  }

  @override
  void dispose() {
    _model.maybeDispose();

    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.max,
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        wrapWithModel(
          model: _model.logoModel,
          updateCallback: () => safeSetState(() {}),
          child: LogoWidget(),
        ),
        Row(
          mainAxisSize: MainAxisSize.max,
          children: [
            badges.Badge(
              badgeContent: Text(
                FFLocalizations.of(context).getText(
                  '7ft4n3pg' /* 0 */,
                ),
                style: FlutterFlowTheme.of(context).titleSmall.override(
                      font: GoogleFonts.dmSans(
                        fontWeight: FontWeight.w500,
                        fontStyle:
                            FlutterFlowTheme.of(context).titleSmall.fontStyle,
                      ),
                      color: Colors.white,
                      fontSize: 12.0,
                      letterSpacing: 0.0,
                      fontWeight: FontWeight.w500,
                      fontStyle:
                          FlutterFlowTheme.of(context).titleSmall.fontStyle,
                    ),
              ),
              showBadge: true,
              shape: badges.BadgeShape.circle,
              badgeColor: FlutterFlowTheme.of(context).secondary,
              elevation: 1.0,
              padding: EdgeInsetsDirectional.fromSTEB(5.0, 5.0, 5.0, 5.0),
              position: badges.BadgePosition.topEnd(),
              animationType: badges.BadgeAnimationType.scale,
              toAnimate: true,
              child: FlutterFlowIconButton(
                borderRadius: 8.0,
                buttonSize: 35.0,
                icon: FaIcon(
                  FontAwesomeIcons.solidBell,
                  color: FlutterFlowTheme.of(context).primaryText,
                  size: 20.0,
                ),
                onPressed: () {
                  print('IconButton pressed ...');
                },
              ),
            ),
            Builder(
              builder: (context) => FlutterFlowIconButton(
                borderRadius: 8.0,
                buttonSize: 45.0,
                icon: Icon(
                  Icons.menu,
                  color: FlutterFlowTheme.of(context).primaryText,
                  size: 28.0,
                ),
                onPressed: () async {
                  await showDialog(
                    barrierColor: FlutterFlowTheme.of(context).primary,
                    context: context,
                    builder: (dialogContext) {
                      return Dialog(
                        elevation: 0,
                        insetPadding: EdgeInsets.zero,
                        backgroundColor: Colors.transparent,
                        alignment: AlignmentDirectional(0.0, 0.0)
                            .resolve(Directionality.of(context)),
                        child: WebViewAware(
                          child: MobalSelectGameTeamsMobileWidget(),
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ].divide(SizedBox(width: 20.0)),
        ),
      ],
    );
  }
}
