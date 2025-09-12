import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'package:flutter/material.dart';
import 'pc_background_image_model.dart';
export 'pc_background_image_model.dart';

class PcBackgroundImageWidget extends StatefulWidget {
  const PcBackgroundImageWidget({super.key});

  @override
  State<PcBackgroundImageWidget> createState() =>
      _PcBackgroundImageWidgetState();
}

class _PcBackgroundImageWidgetState extends State<PcBackgroundImageWidget> {
  late PcBackgroundImageModel _model;

  @override
  void setState(VoidCallback callback) {
    super.setState(callback);
    _model.onUpdate();
  }

  @override
  void initState() {
    super.initState();
    _model = createModel(context, () => PcBackgroundImageModel());

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
        phone: false,
        tablet: false,
        tabletLandscape: false,
      ),
      child: Align(
        alignment: AlignmentDirectional(0.0, -1.0),
        child: Container(
          width: 1920.0,
          height: 800.0,
          child: Stack(
            alignment: AlignmentDirectional(0.0, 0.0),
            children: [
              if (!(Theme.of(context).brightness == Brightness.dark))
                Stack(
                  children: [
                    Opacity(
                      opacity: 0.05,
                      child: Align(
                        alignment: AlignmentDirectional(0.0, 0.0),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(8.0),
                          child: Image.asset(
                            'assets/images/esports-hero.jpg',
                            width: 1920.0,
                            height: 1080.0,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                    Align(
                      alignment: AlignmentDirectional(0.0, -1.03),
                      child: Container(
                        width: 1920.0,
                        height: 1000.0,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0x00FFFFFF), Colors.white],
                            stops: [0.0, 1.0],
                            begin: AlignmentDirectional(0.0, -1.0),
                            end: AlignmentDirectional(0, 1.0),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              if (Theme.of(context).brightness == Brightness.dark)
                Align(
                  alignment: AlignmentDirectional(0.0, 0.0),
                  child: Stack(
                    children: [
                      Opacity(
                        opacity: 0.05,
                        child: Align(
                          alignment: AlignmentDirectional(0.0, 0.0),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8.0),
                            child: Image.asset(
                              'assets/images/esports-hero.jpg',
                              width: 1920.0,
                              height: 1080.0,
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                      ),
                      if (responsiveVisibility(
                        context: context,
                        phone: false,
                        tablet: false,
                        tabletLandscape: false,
                      ))
                        Align(
                          alignment: AlignmentDirectional(0.0, -1.03),
                          child: Container(
                            width: 1920.0,
                            height: 1000.0,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Color(0x00050A11),
                                  FlutterFlowTheme.of(context).primary
                                ],
                                stops: [0.0, 1.0],
                                begin: AlignmentDirectional(0.0, -1.0),
                                end: AlignmentDirectional(0, 1.0),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
